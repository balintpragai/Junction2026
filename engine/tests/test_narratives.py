"""The Narrative cache fill (#17).

The pure parts run everywhere. The fill itself runs against a real Postgres
with the real schema (db/*.sql) when TEST_DATABASE_URL is set, in its own
temporary schema, with synthetic rows and a fake `narrative` client:

    docker run --rm -d --name rl-test-db -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:16
    cd engine && TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/postgres ../.venv/bin/python -m pytest
"""

import json
import os
import threading
import uuid
from pathlib import Path

import psycopg
import pytest
from psycopg.conninfo import make_conninfo

from app import main, narratives
from app.jobs import JobRegistry
from app.narratives import NarrativeInput, fill_cache, generate, input_hash
from app.rescore import RescoreResult
from common.models import Gap, NarrativeConfig, NarrativeRequest, NarrativeResult
from common.template import template_sentence

SCHEMA_DIR = Path(__file__).resolve().parents[2] / "db"
URL = os.environ.get("TEST_DATABASE_URL")
needs_db = pytest.mark.skipif(not URL, reason="set TEST_DATABASE_URL to run the Postgres tests")


def _request(value: float = 74.3, action: str | None = "Act.") -> NarrativeRequest:
    gap = Gap(region_code="t-hki", indicator_code="3621", year=2024, value=value, reference_kind="target",
              reference_value=80.0, deviation=round(value - 80.0, 1), direction="below", severity="act",
              rank=2, n_regions=3, peer_values=[], trend_5y=None)
    return NarrativeRequest(region_name="Helsinki", indicator_name="Breast cancer screening attendance",
                            unit="% of invited", gap=gap, action_text=action)


class FakeClient:
    """Stands in for the `narrative` service: Template sentences, or 'llm' text when a model is set."""

    def __init__(self, model: str = "", prompt_version: str = "v1-test", fail_for: set[str] = frozenset()):
        self.model, self.prompt_version, self.fail_for = model, prompt_version, fail_for
        self.calls: list[NarrativeRequest] = []
        self._lock = threading.Lock()

    def config(self) -> NarrativeConfig:
        return NarrativeConfig(prompt_version=self.prompt_version, model=self.model)

    def narrative(self, request: NarrativeRequest) -> NarrativeResult:
        with self._lock:
            self.calls.append(request)
        if request.gap.region_code in self.fail_for:
            raise OSError("narrative unreachable")
        text = template_sentence(request)
        return NarrativeResult(text=("LLM: " + text) if self.model else text, source="llm" if self.model else "template",
                               language="en", numbers_checked=True, prompt_version=self.prompt_version)


# --- pure ----------------------------------------------------------------------------


def test_input_hash_is_stable_and_covers_request_and_model():
    assert input_hash(_request(), "") == input_hash(_request(), "")
    assert input_hash(_request(), "") != input_hash(_request(value=74.4), "")
    assert input_hash(_request(), "") != input_hash(_request(action="Other."), "")
    assert input_hash(_request(), "") != input_hash(_request(), "some-model")


def test_generate_reports_failures_without_stopping_the_others():
    items = [NarrativeInput(region_id=i, request=_request().model_copy(
        update={"gap": _request().gap.model_copy(update={"region_code": code})})) for i, code in enumerate(["a", "b", "c"])]
    results, failed = generate(items, FakeClient(fail_for={"b"}))
    assert [i.request.gap.region_code for i, _ in results] == ["a", "c"]
    assert [i.request.gap.region_code for i in failed] == ["b"]


def test_job_survives_a_failing_narrative_step(monkeypatch):
    scored = RescoreResult(engine_version="t", gaps_written=3, gaps_removed=0, indicators_scored=1, failures=[])

    def boom(*_args, **_kwargs):
        raise OSError("narrative unreachable")

    result = main.run_job(score=lambda _url: scored, fill=boom)
    assert result.gaps_written == 3 and result.narratives is None
    assert result.narrative_error == "OSError: narrative unreachable"

    jobs = JobRegistry(lambda: result)
    job = jobs.wait(jobs.submit().id, timeout=5)
    assert job.status == "succeeded" and job.narrative_error == "OSError: narrative unreachable"


def test_job_reports_narrative_counts():
    filled = narratives.FillResult(generated=2, kept=1, failed=0, removed=0, sources={"template": 3})
    scored = RescoreResult(engine_version="t", gaps_written=3, gaps_removed=0, indicators_scored=1, failures=[])
    result = main.run_job(score=lambda _url: scored, fill=lambda *_a, **_k: filled)
    jobs = JobRegistry(lambda: result)
    job = jobs.wait(jobs.submit().id, timeout=5)
    assert (job.narratives_generated, job.narratives_kept, job.narratives_failed, job.narrative_sources) == (2, 1, 0, {"template": 3})


# --- against Postgres ----------------------------------------------------------------

REGIONS = [(1, "t-hki", "Helsinki", "city_of_helsinki"), (2, "t-vk", "Vantaa-Kerava", "wellbeing_services_county"),
           (3, "t-ala", "Åland", "aland")]
GAP_COLS = ("region_id, indicator_id, year, value, reference_kind, reference_value, deviation, direction, severity, "
            "rank, n_regions, peer_values, trend_5y, data_quality_notes, engine_version")


@pytest.fixture
def db_url():
    """A fresh schema per test, so each test starts from an empty cache."""
    schema = f"test_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(URL, autocommit=True) as conn:
        conn.execute(f'CREATE SCHEMA "{schema}"')
    url = make_conninfo(URL, options=f"-csearch_path={schema}")
    try:
        with psycopg.connect(url) as conn:
            for sql in sorted(SCHEMA_DIR.glob("*.sql")):
                conn.execute(sql.read_text(encoding="utf-8"))
            _insert(conn)
        yield url
    finally:
        with psycopg.connect(URL, autocommit=True) as conn:
            conn.execute(f'DROP SCHEMA "{schema}" CASCADE')


def _insert(conn):
    for rid, code, name, kind in REGIONS:
        conn.execute("INSERT INTO dim_region (region_id, code, name_en, name_fi, name_sv, kind) VALUES (%s,%s,%s,%s,%s,%s)",
                     (rid, code, name, name, name, kind))
    conn.execute("INSERT INTO dim_indicator (indicator_id, name, name_fi, source, unit, pathway_stage, has_named_target, "
                 "target_value, higher_is_better) VALUES ('3621', 'Breast cancer screening attendance', NULL, 't', "
                 "'% of invited', 'detection', true, 80, true)")
    conn.execute("INSERT INTO dim_indicator (indicator_id, name, source, unit, pathway_stage, has_named_target, "
                 "higher_is_better) VALUES ('3627', 'Bowel cancer five-year relative survival', 't', '%', 'outcome', false, true)")
    # 3621: 2023 and 2024 (latest = 2024, 3 Regions). 3627: 2023 only (latest = 2023, 2 Regions).
    for rid, iid, year, value, dev in [(1, "3621", 2023, 75.0, -5.0), (1, "3621", 2024, 74.3, -5.7),
                                       (2, "3621", 2024, 76.7, -3.3), (3, "3621", 2024, 81.0, 1.0),
                                       (1, "3627", 2023, 66.0, -1.0), (2, "3627", 2023, 68.0, 1.0)]:
        ref_kind, ref = ("target", 80.0) if iid == "3621" else ("peer_median", 67.0)
        direction = "below" if dev < 0 else "above"
        notes = json.dumps([{"code": "short_history", "message": "Only a few years of data."}] if rid == 2 else [])
        conn.execute(f"INSERT INTO fact_gap_score ({GAP_COLS}) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'watch',1,3,'[]',NULL,%s,'t')",
                     (rid, iid, year, value, ref_kind, ref, dev, direction, notes))
    for aid, text, rank in [("A2", "Second action.", 2), ("A1", "Invite non-attenders again.", 1), ("A0", "", 0)]:
        conn.execute("INSERT INTO dim_strategy_action (action_id, action_text) VALUES (%s, %s)", (aid, text))
        conn.execute("INSERT INTO strategy_action_indicator (indicator_id, action_id, rank) VALUES ('3621', %s, %s)", (aid, rank))


def _rows(url):
    with psycopg.connect(url) as conn:
        return conn.execute("SELECT region_id, indicator_id, year, source, model, prompt_version, input_hash, text "
                            "FROM narrative_cache ORDER BY indicator_id, year, region_id").fetchall()


@needs_db
def test_first_fill_caches_every_latest_year_gap(db_url):
    client = FakeClient()
    r = fill_cache(db_url, client)
    assert (r.generated, r.kept, r.failed, r.removed, r.sources) == (5, 0, 0, 0, {"template": 5})
    rows = _rows(db_url)
    assert [(rid, iid, y) for rid, iid, y, *_ in rows] == [(1, "3621", 2024), (2, "3621", 2024), (3, "3621", 2024),
                                                          (1, "3627", 2023), (2, "3627", 2023)]
    assert all(src == "template" and model == "" and pv == "v1-test" and len(h) == 64 for _, _, _, src, model, pv, h, _ in rows)
    # The request carries the matched action (lowest rank with text) and the data-quality notes.
    by_region = {(c.gap.region_code, c.gap.indicator_code): c for c in client.calls}
    assert by_region[("t-hki", "3621")].action_text == "Invite non-attenders again."
    assert by_region[("t-vk", "3621")].data_quality_note == "Only a few years of data."
    assert by_region[("t-hki", "3627")].action_text is None


@needs_db
def test_unchanged_inputs_regenerate_nothing(db_url):
    fill_cache(db_url, FakeClient())
    before = _rows(db_url)
    client = FakeClient()
    r = fill_cache(db_url, client)
    assert (r.generated, r.kept, r.failed, r.removed) == (0, 5, 0, 0)
    assert client.calls == []
    assert _rows(db_url) == before


@needs_db
def test_changed_gap_regenerates_only_that_row(db_url):
    fill_cache(db_url, FakeClient())
    with psycopg.connect(db_url) as conn:
        conn.execute("UPDATE fact_gap_score SET value = 74.0, deviation = -6.0 WHERE region_id = 1 AND indicator_id = '3621' AND year = 2024")
    client = FakeClient()
    r = fill_cache(db_url, client)
    assert (r.generated, r.kept) == (1, 4)
    assert [(c.gap.region_code, c.gap.value) for c in client.calls] == [("t-hki", 74.0)]


@needs_db
def test_prompt_version_or_model_change_regenerates_everything(db_url):
    fill_cache(db_url, FakeClient())
    assert fill_cache(db_url, FakeClient(prompt_version="v2-test")).generated == 5
    r = fill_cache(db_url, FakeClient(model="some-model", prompt_version="v2-test"))
    assert (r.generated, r.sources) == (5, {"llm": 5})
    assert {(src, model) for _, _, _, src, model, *_ in _rows(db_url)} == {("llm", "some-model")}


@needs_db
def test_failed_regeneration_drops_the_outdated_row(db_url):
    fill_cache(db_url, FakeClient())
    with psycopg.connect(db_url) as conn:
        conn.execute("UPDATE fact_gap_score SET value = 74.0, deviation = -6.0 WHERE region_id = 1 AND indicator_id = '3621' AND year = 2024")
    r = fill_cache(db_url, FakeClient(fail_for={"t-hki"}))
    assert (r.generated, r.failed, r.removed) == (0, 1, 1)
    assert (1, "3621", 2024) not in {(rid, iid, y) for rid, iid, y, *_ in _rows(db_url)}


@needs_db
def test_new_latest_year_replaces_the_old_years_rows(db_url):
    fill_cache(db_url, FakeClient())
    with psycopg.connect(db_url) as conn:
        conn.execute(f"INSERT INTO fact_gap_score ({GAP_COLS}) VALUES (1,'3627',2024,65,'peer_median',67,-2,'below','watch',1,2,'[]',NULL,'[]','t')")
    r = fill_cache(db_url, FakeClient())
    assert (r.generated, r.removed) == (1, 2)
    assert {(iid, y) for _, iid, y, *_ in _rows(db_url)} == {("3621", 2024), ("3627", 2024)}
