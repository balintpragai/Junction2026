"""PostgresRepository against a real Postgres, with the real schema (db/*.sql).

Skipped unless TEST_DATABASE_URL is set. Each run works in its own temporary
schema and drops it afterwards, so any scratch Postgres will do:

    docker run --rm -d --name rl-test-db -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:16
    TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/postgres \
        ../.venv/bin/python -m pytest tests/test_repository_postgres.py

The rows below are synthetic test data shaped like the Helsinki breast-screening
2024 case; they are not loaded from data/.
"""

import json
import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_repository
from app.repository import ECOLOGICAL_FALLACY_NOTE, NotFound, PostgresRepository
from common.models import GapSummary, OutreachList

psycopg = pytest.importorskip("psycopg")
from psycopg.conninfo import make_conninfo  # noqa: E402

URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="set TEST_DATABASE_URL to run the Postgres tests")

SCHEMA_DIR = Path(__file__).resolve().parents[2] / "db"

REGIONS = [
    # region_id, code, name_en, kind, parent_area
    (1, "t-hki", "Helsinki", "city_of_helsinki", "uusimaa"),
    (2, "t-vk", "Vantaa-Kerava", "wellbeing_services_county", "uusimaa"),
    (3, "t-ala", "Åland", "aland", None),
    (4, "t-up", "Upland", "wellbeing_services_county", "uusimaa"),
]
INDICATORS = [
    # indicator_id, name, name_fi, unit, stage, has_target, target, higher_is_better
    ("3621", "Breast cancer screening attendance", "Rintasyöpäseulontaan osallistuminen", "%", "detection", True, 80.0, True),
    ("3620", "Cervical cancer screening attendance", None, "%", "detection", False, None, True),
    ("cov_test", "A covariate", None, "%", "covariate", False, None, None),
    ("foreign_background_pct", "People with a foreign background", None, "% of population", "covariate", False, None, None),
    ("lib_test", "Lower is better, with a Target", None, "%", "referral", True, 10.0, False),
]
# Outreach: extra 2024 Gaps (region_id, indicator, value, deviation, direction, severity)
OUTREACH_GAPS = [
    (2, "3621", 73.2, -6.8, "below", "act"),   # furthest below: rank 1
    (4, "3621", 83.0, 3.0, "above", "ok"),     # above the Target: not listed
    (1, "lib_test", 12.0, 2.0, "above", "watch"),  # lower is better: above = wrong side, listed
    (2, "lib_test", 8.0, -2.0, "below", "ok"),     # lower is better: below = fine, not listed
]
# Covariate values (region_id, indicator, year, value); NULL rows carry a note.
COVARIATES = [
    (1, "foreign_background_pct", 2023, 18.0),
    (1, "foreign_background_pct", 2024, 19.0),
    (1, "foreign_background_pct", 2025, 20.0),  # after the year: ignored
    (1, "cov_test", 2022, 5.0),                 # latest at or before 2024 is 2022
    (2, "foreign_background_pct", 2024, 24.0),
    (2, "cov_test", 2023, None),                # no value: ignored
]
HKI_VALUES = {2019: 80.6, 2020: None, 2021: 77.4, 2022: 76.2, 2023: 75.0, 2024: 74.3, 2025: 73.0}
HKI_2024_GAP = dict(
    value=74.3, reference_kind="target", reference_value=80.0, deviation=-5.7, direction="below",
    severity="act", rank=21, n_regions=23, peer_values=[{"region_code": "t-vk", "value": 73.2}],
    trend_5y=-6.3, data_quality_notes=[{"code": "test_note", "message": "Synthetic note for the test."}],
)
ACTIONS = [
    # action_id, sub_objective_title, goal, action_text, strategy_page, link rank
    ("A1", "Screening participation", "Prevention", "Raise participation with targeted invitations.", "42", 1),
    ("A2", "Second choice", "Prevention", "A lower-ranked action.", None, 2),
    ("A0", "Empty text", "Prevention", "", None, 0),  # ranked first but has no text: skipped
    ("A9", None, "Unranked goal", "An unranked action.", None, None),
]


@pytest.fixture(scope="module")
def db_url():
    schema = f"test_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(URL, autocommit=True) as conn:
        conn.execute(f'CREATE SCHEMA "{schema}"')
    url = make_conninfo(URL, options=f"-csearch_path={schema}")
    try:
        with psycopg.connect(url) as conn:
            for sql in sorted(SCHEMA_DIR.glob("*.sql")):
                conn.execute(sql.read_text(encoding="utf-8"))
            _insert_rows(conn)
        yield url
    finally:
        with psycopg.connect(URL, autocommit=True) as conn:
            conn.execute(f'DROP SCHEMA "{schema}" CASCADE')


def _insert_rows(conn):
    for rid, code, name, kind, area in REGIONS:
        conn.execute(
            "INSERT INTO dim_region (region_id, code, name_en, name_fi, name_sv, kind, parent_area)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (rid, code, name, name, name, kind, area),
        )
    for iid, name, name_fi, unit, stage, has_t, target, hib in INDICATORS:
        conn.execute(
            "INSERT INTO dim_indicator (indicator_id, name, name_fi, source, unit, pathway_stage,"
            " has_named_target, target_value, higher_is_better) VALUES (%s, %s, %s, 'test', %s, %s, %s, %s, %s)",
            (iid, name, name_fi, unit, stage, has_t, target, hib),
        )
    for year, value in HKI_VALUES.items():
        notes = [] if value is not None else [{"code": "missing_value", "message": "No value published."}]
        conn.execute(
            "INSERT INTO fact_indicator_value VALUES (1, '3621', %s, %s, %s)", (year, value, json.dumps(notes))
        )
    gap_cols = "region_id, indicator_id, year, value, reference_kind, reference_value, deviation, direction, severity, rank, n_regions, peer_values, trend_5y, data_quality_notes, engine_version"
    for year, gap in ((2024, HKI_2024_GAP), (2023, {**HKI_2024_GAP, "value": 75.0, "deviation": -5.0, "severity": "act"})):
        conn.execute(
            f"INSERT INTO fact_gap_score ({gap_cols}) VALUES (1, '3621', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'test')",
            (year, gap["value"], gap["reference_kind"], gap["reference_value"], gap["deviation"], gap["direction"],
             gap["severity"], gap["rank"], gap["n_regions"], json.dumps(gap["peer_values"]), gap["trend_5y"],
             json.dumps(gap["data_quality_notes"])),
        )
    for rid, iid, value, dev, direction, severity in OUTREACH_GAPS:
        conn.execute(
            f"INSERT INTO fact_gap_score ({gap_cols}) VALUES (%s, %s, 2024, %s, 'target', %s, %s, %s, %s, 1, 4, '[]', NULL, '[]', 'test')",
            (rid, iid, value, 80.0 if iid == "3621" else 10.0, dev, direction, severity),
        )
    for rid, iid, year, value in COVARIATES:
        notes = [] if value is not None else [{"code": "missing_value", "message": "No value published."}]
        conn.execute("INSERT INTO fact_indicator_value VALUES (%s, %s, %s, %s, %s)", (rid, iid, year, value, json.dumps(notes)))
    for aid, title, goal, text, page, rank in ACTIONS:
        conn.execute(
            "INSERT INTO dim_strategy_action (action_id, sub_objective_title, goal, action_text, strategy_page)"
            " VALUES (%s, %s, %s, %s, %s)",
            (aid, title, goal, text, page),
        )
        conn.execute("INSERT INTO strategy_action_indicator (indicator_id, action_id, rank) VALUES ('3621', %s, %s)", (aid, rank))


@pytest.fixture
def repo(db_url):
    return PostgresRepository(db_url)


def test_regions_sorted_by_name(repo):
    assert [r.name for r in repo.list_regions().regions] == ["Helsinki", "Upland", "Vantaa-Kerava", "Åland"]


def test_indicators_exclude_covariates_and_list_scored_years(repo):
    indicators = {i.code: i for i in repo.list_indicators().indicators}
    assert set(indicators) == {"3620", "3621", "lib_test"}
    assert indicators["3621"].years == [2023, 2024]
    assert indicators["3621"].target == 80.0
    assert indicators["3620"].years == [] and indicators["3620"].target is None


def test_helsinki_gap_summary(repo):
    s = repo.gap_summary("t-hki", "3621", 2024)
    GapSummary.model_validate(s.model_dump())
    g = s.gap
    assert (g.value, g.reference_value, g.deviation, g.direction, g.severity) == (74.3, 80.0, -5.7, "below", "act")
    assert (g.rank, g.n_regions, g.trend_5y) == (21, 23, -6.3)
    assert [(p.region_code, p.value) for p in g.peer_values] == [("t-vk", 73.2)]
    assert [(n.code, n.message) for n in s.data_quality_notes] == [("test_note", "Synthetic note for the test.")]
    # Trend: values up to the requested year only, NULL years left out.
    assert [(t.year, t.value) for t in s.trend] == [(2019, 80.6), (2021, 77.4), (2022, 76.2), (2023, 75.0), (2024, 74.3)]
    # Matched action: lowest rank with text; empty text skipped.
    assert (s.action.id, s.action.title, s.action.source) == ("A1", "Screening participation", "National Cancer Strategy 2026–2035, p. 42")
    assert s.narrative.source == "template" and s.narrative.language == "en"
    assert s.narrative.text == "Helsinki is 5.7 pp below the 80% target for breast cancer screening attendance in 2024, ranking 21 of 23."


@pytest.mark.parametrize(
    ("region", "indicator", "year", "message"),
    [
        ("nowhere", "3621", 2024, "Unknown region code 'nowhere'"),
        ("t-hki", "9999", 2024, "Unknown indicator code '9999'"),
        ("t-hki", "cov_test", 2024, "Unknown indicator code 'cov_test'"),  # covariates have no Gaps
        ("t-hki", "3621", 2025, "No Gap for region 't-hki', indicator '3621' in 2025"),  # value but not scored
        ("t-ala", "3621", 2024, "No Gap for region 't-ala', indicator '3621' in 2024"),
    ],
)
def test_not_found(repo, region, indicator, year, message):
    with pytest.raises(NotFound, match=message):
        repo.gap_summary(region, indicator, year)


def test_routes_over_real_postgres(db_url):
    app.dependency_overrides[get_repository] = lambda: PostgresRepository(db_url)
    client = TestClient(app)
    r = client.get("/regions/t-hki/gap-summary?indicator=3621&year=2024")
    assert r.status_code == 200 and r.headers["cache-control"] == "max-age=300"
    GapSummary.model_validate(r.json())
    for path in ("/regions/nowhere/gap-summary?indicator=3621&year=2024",
                 "/regions/t-hki/gap-summary?indicator=9999&year=2024"):
        assert client.get(path).status_code == 404
    assert client.get("/regions").status_code == 200
    assert client.get("/indicators").status_code == 200


# --- outreach list (#16) ---------------------------------------------------------


def test_outreach_breast_screening(repo):
    o = repo.outreach_list("3621", 2024)
    OutreachList.model_validate(o.model_dump())
    assert (o.reference_kind, o.reference_value, o.year) == ("target", 80.0, 2024)
    assert o.ecological_fallacy_note == ECOLOGICAL_FALLACY_NOTE and o.ecological_fallacy_note.strip()
    # Below the Target only, largest Gap first; Upland (above) is left out.
    assert [(r.rank, r.region.code, r.deviation, r.severity) for r in o.rows] == [
        (1, "t-vk", -6.8, "act"),
        (2, "t-hki", -5.7, "act"),
    ]
    hki = o.rows[1].covariates
    assert hki.immigrant_background_share_pct == 19.0
    assert [(v.code, v.year, v.value) for v in hki.values] == [("cov_test", 2022, 5.0), ("foreign_background_pct", 2024, 19.0)]
    vk = o.rows[0].covariates
    assert vk.immigrant_background_share_pct == 24.0
    assert [v.code for v in vk.values] == ["foreign_background_pct"]  # NULL cov_test left out


def test_outreach_lower_is_better_lists_regions_above_the_target(repo):
    o = repo.outreach_list("lib_test", 2024)
    assert [(r.region.code, r.deviation) for r in o.rows] == [("t-hki", 2.0)]


def test_outreach_earlier_year_uses_covariates_up_to_that_year(repo):
    o = repo.outreach_list("3621", 2023)
    assert [r.region.code for r in o.rows] == ["t-hki"]
    assert [(v.code, v.year, v.value) for v in o.rows[0].covariates.values] == [
        ("cov_test", 2022, 5.0), ("foreign_background_pct", 2023, 18.0)]


@pytest.mark.parametrize(
    ("indicator", "year", "message"),
    [
        ("9999", 2024, "Unknown indicator code '9999'"),
        ("cov_test", 2024, "Unknown indicator code 'cov_test'"),
        ("3620", 2024, "Indicator '3620' has no Target"),
        ("3621", 2019, "No Gaps for indicator '3621' in 2019"),
    ],
)
def test_outreach_not_found(repo, indicator, year, message):
    with pytest.raises(NotFound, match=message):
        repo.outreach_list(indicator, year)


def test_outreach_route_over_real_postgres(db_url):
    app.dependency_overrides[get_repository] = lambda: PostgresRepository(db_url)
    client = TestClient(app)
    r = client.get("/outreach-list?indicator=3621&year=2024")
    assert r.status_code == 200 and r.headers["cache-control"] == "max-age=300"
    OutreachList.model_validate(r.json())
    assert client.get("/outreach-list?indicator=3620&year=2024").status_code == 404
