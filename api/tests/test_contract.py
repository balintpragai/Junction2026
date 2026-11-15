"""Every public route answers and its body validates against its contract model."""

import statistics

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from common.models import (
    ActionLibrary,
    GapSummary,
    Health,
    IndicatorList,
    OutreachList,
    Overview,
    RegionList,
    RegionProfile,
)

client = TestClient(app)

ROUTES = [
    ("/health", Health),
    ("/regions", RegionList),
    ("/indicators", IndicatorList),
    ("/regions/helsinki/gap-summary?indicator=3621&year=2024", GapSummary),
    ("/outreach-list?indicator=3621&year=2024", OutreachList),
    ("/overview", Overview),
    ("/regions/helsinki/profile", RegionProfile),
    ("/regions/helsinki/action-library", ActionLibrary),
]


@pytest.mark.parametrize(("path", "model"), ROUTES)
def test_route_validates_against_model(path, model):
    r = client.get(path)
    assert r.status_code == 200, r.text
    model.model_validate(r.json())


def test_openapi_lists_public_routes_with_typed_schemas():
    spec = client.get("/openapi.json").json()
    expected = {
        "/regions": "RegionList",
        "/indicators": "IndicatorList",
        "/regions/{code}/gap-summary": "GapSummary",
        "/outreach-list": "OutreachList",
    }
    for path, schema in expected.items():
        ref = spec["paths"][path]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"]
        assert ref == f"#/components/schemas/{schema}"


def test_helsinki_breast_screening_2024_case():
    gap = GapSummary.model_validate(
        client.get("/regions/helsinki/gap-summary?indicator=3621&year=2024").json()
    ).gap
    assert (gap.value, gap.reference_kind, gap.reference_value) == (74.3, "target", 80.0)
    assert gap.deviation == -5.7
    assert (gap.direction, gap.severity) == ("below", "act")


def test_gap_fixture_is_internally_consistent():
    s = GapSummary.model_validate(
        client.get("/regions/helsinki/gap-summary?indicator=3621&year=2024").json()
    )
    g = s.gap
    assert round(g.value - g.reference_value, 1) == g.deviation
    assert len(g.peer_values) == g.n_regions
    ranked = sorted(g.peer_values, key=lambda p: -p.value)
    assert ranked[g.rank - 1].region_code == g.region_code
    assert s.trend[-1].value == g.value
    assert f"{abs(g.deviation)} pp below" in s.narrative.text
    assert statistics.median(p.value for p in g.peer_values) > g.value


def test_outreach_list_requires_ecological_fallacy_note():
    body = client.get("/outreach-list?indicator=3621&year=2024").json()
    assert body["ecological_fallacy_note"]
    for bad in ({k: v for k, v in body.items() if k != "ecological_fallacy_note"},
                {**body, "ecological_fallacy_note": ""}):
        with pytest.raises(ValidationError):
            OutreachList.model_validate(bad)
    assert "ecological_fallacy_note" in client.get("/openapi.json").json()["components"]["schemas"]["OutreachList"]["required"]


def test_outreach_rows_are_below_target_and_ranked_by_gap():
    o = OutreachList.model_validate(client.get("/outreach-list?indicator=3621&year=2024").json())
    devs = [row.deviation for row in o.rows]
    assert all(d < 0 for d in devs)
    assert devs == sorted(devs)
    assert [row.rank for row in o.rows] == list(range(1, len(o.rows) + 1))


@pytest.mark.parametrize("path", [
    "/regions/nowhere/gap-summary?indicator=3621&year=2024",       # unknown Region
    "/regions/helsinki/gap-summary?indicator=9999&year=2024",      # unknown indicator
    "/regions/helsinki/gap-summary?indicator=3621&year=1990",      # no Gap that year
    "/outreach-list?indicator=9999&year=2024",
])
def test_unknown_combination_is_404(path):
    r = client.get(path)
    assert r.status_code == 404
    assert r.json()["detail"]


def test_database_down_is_503_not_500():
    import psycopg

    from app.main import get_repository

    class DownRepository:
        def list_regions(self):
            raise psycopg.OperationalError("connection refused")

    app.dependency_overrides[get_repository] = DownRepository
    r = client.get("/regions")
    assert r.status_code == 503
    assert "connection refused" not in r.text  # no internals leak to the client


def test_cache_control_header():
    assert client.get("/regions").headers["cache-control"] == "max-age=300"


# --- The Decision Map's routes ----------------------------------------------


def test_overview_has_a_row_per_region():
    body = client.get("/overview").json()
    regions = client.get("/regions").json()["regions"]
    assert body["year"] == 2024
    assert len(body["rows"]) == len(regions)
    assert {r["region"]["code"] for r in body["rows"]} == {r["code"] for r in regions}


def test_overview_counts_never_exceed_what_is_tracked():
    for row in client.get("/overview").json()["rows"]:
        assert row["indicators_act"] + row["indicators_watch"] <= row["indicators_tracked"]


def test_profile_carries_the_three_layer_card_for_every_gap():
    body = client.get("/regions/helsinki/profile").json()
    assert body["region"]["code"] == "helsinki"
    assert body["year"] == 2024
    assert body["gaps"], "a profile with no Gap should 404, not return an empty list"
    entry = body["gaps"][0]
    # Layer 1: the Narrative, with the source the UI discloses.
    assert entry["narrative"]["text"]
    assert entry["narrative"]["source"] in {"llm", "template"}
    # Layer 2: the number, with direction and rank.
    assert entry["gap"]["value"] is not None
    assert entry["gap"]["direction"] in {"above", "below", "at"}
    assert entry["gap"]["rank"] >= 1
    # Layer 3's series. Present in the contract whether or not the UI draws it.
    assert isinstance(entry["trend"], list)
    assert isinstance(entry["data_quality_notes"], list)


def test_profile_summary_matches_the_gaps_it_lists():
    body = client.get("/regions/helsinki/profile").json()
    severities = [g["gap"]["severity"] for g in body["gaps"]]
    assert body["summary"]["indicators_tracked"] == len(body["gaps"])
    assert body["summary"]["indicators_act"] == severities.count("act")
    assert body["summary"]["indicators_watch"] == severities.count("watch")


def test_profile_covariate_meta_is_keyed_like_covariates():
    body = client.get("/regions/helsinki/profile").json()
    assert set(body["covariate_meta"]) == set(body["covariates"])


def test_profile_synthesis_is_plain_sentences():
    body = client.get("/regions/helsinki/profile").json()
    assert body["synthesis"]
    assert all(isinstance(s, str) and s.strip() for s in body["synthesis"])


def test_profile_candidate_actions_carry_a_workflow_and_a_reason():
    body = client.get("/regions/helsinki/profile").json()
    for action in body["candidate_actions"]:
        assert action["kind"] in {"strategy", "covariate"}
        assert action["why"].strip()
        assert action["workflow"]["type"] in {"stakeholder_message", "patient_message"}


def test_unknown_region_profile_is_404():
    r = client.get("/regions/not-a-region/profile")
    assert r.status_code == 404
    assert "detail" in r.json()


def test_year_without_gaps_is_404_not_an_empty_profile():
    r = client.get("/regions/helsinki/profile", params={"year": 1999})
    assert r.status_code == 404


def test_action_library_is_the_whole_strategy_not_recommended():
    body = client.get("/regions/helsinki/action-library").json()
    assert body["region_code"] == "helsinki"
    assert body["actions"]
    assert all(a["recommended"] is False for a in body["actions"])


def test_unknown_region_action_library_is_404():
    assert client.get("/regions/not-a-region/action-library").status_code == 404
