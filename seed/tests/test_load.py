"""Tests for seed/seed/load.py. Synthetic files only, except the registry check,
which reads just the header row of each processed file it names."""

import json
from pathlib import Path

import pytest

from seed import load

REPO = Path(__file__).resolve().parents[2]
REGION_CODES = {"01", "90", "91"}

REGISTRY_HEADER = ",".join(load.REGISTRY_COLUMNS)


def write(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    return path


def spec(**overrides) -> load.IndicatorSpec:
    base = dict(
        indicator_id="3621", name="Breast", name_fi=None, source="test", unit="%",
        pathway_stage="detection", cancer_type="breast", target_value=80.0, higher_is_better=True,
        source_file="long.csv", source_column=None, note=None, row_note_column=None,
    )
    base.update(overrides)
    return load.IndicatorSpec(**base)


LONG_CSV = """indicator_id,indicator_name,region_id,region_code,region_name_en,year,value,abs_value
3621,Breast,961,01,East,2023,81.0,
3621,Breast,961,01,East,2024,,
3621,Breast,960,90,Helsinki,2024,74.3,
3621,Breast,1,358,Whole country,2024,80.1,
3620,Cervical,960,90,Helsinki,2024,60.0,
"""


# --- Registry ---------------------------------------------------------------


def test_registry_derives_target_and_allows_covariate_without_direction(tmp_path):
    path = write(
        tmp_path / "indicators.csv",
        REGISTRY_HEADER + "\n"
        "3621,Breast,,src,%,detection,breast,80,true,a.csv,,,,\n"
        "2331,Density,,src,per km2,covariate,,,,b.csv,,,,\n",
    )
    screening, density = load.read_indicator_registry(path)
    assert screening.has_named_target and screening.target_value == 80 and screening.higher_is_better is True
    assert not density.has_named_target and density.higher_is_better is None and density.is_covariate


@pytest.mark.parametrize(
    "row, message",
    [
        ("1,X,,src,%,diagnosis,,,true,a.csv,,,,", "pathway_stage"),
        ("1,X,,src,%,outcome,,,,a.csv,,,,", "higher_is_better is required"),
        ("1,X,,src,%,outcome,,,maybe,a.csv,,,,", "true or false"),
        ("1,X,,src,%,outcome,,,true,a.csv,,code_only,,", "note_code and note"),
    ],
)
def test_registry_rejects_bad_rows(tmp_path, row, message):
    path = write(tmp_path / "indicators.csv", REGISTRY_HEADER + "\n" + row + "\n")
    with pytest.raises(load.SeedInputError, match=message):
        load.read_indicator_registry(path)


def test_shipped_registry_matches_processed_file_headers():
    """Every indicator names a file that exists and a column it has. Reads header rows only."""
    specs = load.read_indicator_registry(REPO / "data" / "curated" / "indicators.csv")
    assert len({s.indicator_id for s in specs}) == len(specs)
    for s in specs:
        path = REPO / "data" / "processed" / s.source_file
        assert path.exists(), s.source_file
        with open(path, encoding="utf-8-sig") as f:
            header = f.readline().strip().split(",")
        assert (s.source_column or "value") in header, (s.indicator_id, s.source_file)
        if s.row_note_column:
            assert s.row_note_column in header
    by_id = {s.indicator_id: s for s in specs}
    for screening in ("3620", "3621", "6103"):
        assert by_id[screening].target_value == 80 and by_id[screening].higher_is_better is True


def test_shipped_known_missing_names_registered_indicators():
    specs = load.read_indicator_registry(REPO / "data" / "curated" / "indicators.csv")
    known = load.read_known_missing(REPO / "data" / "curated" / "known_missing_values.csv")
    assert {k.indicator_id for k in known} <= {s.indicator_id for s in specs}
    helsinki_3336 = [k for k in known if (k.region_code, k.indicator_id) == ("90", "3336")]
    assert [(k.year_from, k.year_to) for k in helsinki_3336] == [(2022, 2024)]


# --- Values -----------------------------------------------------------------


def test_long_format_picks_indicator_and_skips_whole_country(tmp_path):
    write(tmp_path / "long.csv", LONG_CSV)
    facts, report = load.read_indicator_values(spec(), tmp_path, REGION_CODES)
    assert {(f.region_code, f.year, f.value) for f in facts} == {("01", 2023, 81.0), ("01", 2024, None), ("90", 2024, 74.3)}
    assert report == load.LoadReport(rows=3, regions=2, skipped_non_region_rows=1)


def test_empty_cell_is_null_with_a_note_never_zero(tmp_path):
    write(tmp_path / "long.csv", LONG_CSV)
    facts, _ = load.read_indicator_values(spec(), tmp_path, REGION_CODES)
    empty = next(f for f in facts if (f.region_code, f.year) == ("01", 2024))
    assert empty.value is None
    assert [n["code"] for n in empty.notes] == ["missing_value"]


def test_wide_covariate_column_gets_ecological_fallacy_and_row_note(tmp_path):
    write(
        tmp_path / "wide.csv",
        "region_id,region_code,region_name_en,year,physician_vacancy_pct,aggregation_method\n"
        "961,1,East,2022,12.5,inherited HUS-wide value\n"
        "960,90,Helsinki,2022,3.0,\n",
    )
    covariate = spec(
        indicator_id="3892", pathway_stage="covariate", higher_is_better=None, target_value=None,
        source_file="wide.csv", source_column="physician_vacancy_pct", row_note_column="aggregation_method",
        note={"code": "legacy_geography", "message": "legacy"},
    )
    facts, _ = load.read_indicator_values(covariate, tmp_path, REGION_CODES)
    east = next(f for f in facts if f.region_code == "01")  # '1' normalised to '01'
    assert east.value == 12.5
    assert [n["code"] for n in east.notes] == ["legacy_geography", "aggregation_method", "ecological_fallacy"]
    helsinki = next(f for f in facts if f.region_code == "90")
    assert [n["code"] for n in helsinki.notes] == ["legacy_geography", "ecological_fallacy"]


def test_snapshot_date_gives_the_year(tmp_path):
    write(
        tmp_path / "broadband.csv",
        "region_id,region_code,region_name_en,snapshot_date,pct_households_ge_30mbit\n"
        "960,90,Helsinki,2025-09-30,99.0\n",
    )
    s = spec(pathway_stage="covariate", higher_is_better=None, target_value=None,
             source_file="broadband.csv", source_column="pct_households_ge_30mbit")
    facts, _ = load.read_indicator_values(s, tmp_path, REGION_CODES)
    assert [f.year for f in facts] == [2025]


def test_duplicate_region_year_is_an_error(tmp_path):
    write(tmp_path / "long.csv", LONG_CSV + "3621,Breast,960,90,Helsinki,2024,75.0,\n")
    with pytest.raises(load.SeedInputError, match="second value"):
        load.read_indicator_values(spec(), tmp_path, REGION_CODES)


def test_bad_number_error_names_line_not_value(tmp_path):
    write(tmp_path / "long.csv", LONG_CSV.replace("74.3", "secret"))
    with pytest.raises(load.SeedInputError) as err:
        load.read_indicator_values(spec(), tmp_path, REGION_CODES)
    assert "line 4" in str(err.value) and "secret" not in str(err.value)


def test_no_matching_rows_is_an_error(tmp_path):
    write(tmp_path / "long.csv", LONG_CSV)
    with pytest.raises(load.SeedInputError, match="no rows"):
        load.read_indicator_values(spec(indicator_id="9999"), tmp_path, REGION_CODES)


# --- Known missing ----------------------------------------------------------


def test_known_missing_adds_null_rows_and_overrides_a_zero():
    note = {"code": "reporting_break", "message": "missing"}
    facts = [
        load.FactRow("90", "3336", 2021, 50.0, []),
        load.FactRow("90", "3336", 2022, 0.0, []),
        load.FactRow("90", "3336", 2023, None, [dict(load.MISSING_VALUE_NOTE)]),
    ]
    known = [load.KnownMissing("90", "3336", 2022, 2024, note)]
    report = load.apply_known_missing(facts, known, REGION_CODES)
    by_year = {f.year: f for f in facts}
    assert by_year[2021].value == 50.0 and by_year[2021].notes == []
    for year in (2022, 2023, 2024):
        assert by_year[year].value is None
        assert by_year[year].notes == [note]
    assert report == load.KnownMissingReport(nulled=1, added=1, already_null=1)


def test_known_missing_for_unloaded_indicator_is_an_error():
    known = [load.KnownMissing("90", "3336", 2022, 2022, {"code": "x", "message": "y"})]
    with pytest.raises(load.SeedInputError, match="not loaded"):
        load.apply_known_missing([load.FactRow("90", "3621", 2022, 1.0, [])], known, REGION_CODES)


# --- Regions and curated files ----------------------------------------------


def _regions_json(tmp_path, n=23):
    raw = [
        {"id": 900 + i, "code": f"{i:02d}" if i < 22 else str(68 + i), "category": "HYVINVOINTIALUE",
         "title": {"en": f"R{i}", "fi": f"R{i}", "sv": f"R{i}"}}
        for i in range(1, n + 1)
    ]
    raw.append({"id": 1, "code": "091", "category": "KUNTA", "title": {"en": "x", "fi": "x", "sv": "x"}})
    return write(tmp_path / "regions.json", json.dumps(raw))


def test_regions_are_the_23_with_helsinki_and_aland_kinds(tmp_path):
    regions = load.read_regions(_regions_json(tmp_path))
    assert len(regions) == 23
    kinds = {r.code: r.kind for r in regions}
    assert kinds["90"] == "city_of_helsinki" and kinds["91"] == "aland" and kinds["01"] == "wellbeing_services_county"


def test_wrong_region_count_is_an_error(tmp_path):
    with pytest.raises(load.SeedInputError, match="expected 23"):
        load.read_regions(_regions_json(tmp_path, n=22))


def test_parent_areas_optional_and_applied(tmp_path):
    regions = load.read_regions(_regions_json(tmp_path))
    same, present = load.apply_parent_areas(regions, tmp_path / "absent.csv")
    assert same == regions and not present

    path = write(tmp_path / "pa.csv", "region_code,region_name_en,parent_area,basis,note\n1,R1,Uusimaa,province,\n")
    updated, present = load.apply_parent_areas(regions, path)
    assert present
    assert next(r for r in updated if r.code == "01").parent_area == "Uusimaa"
    assert next(r for r in updated if r.code == "90").parent_area is None


def test_strategy_files_optional_and_rank_parsed(tmp_path):
    assert load.read_strategy_actions(tmp_path / "absent.csv") is None
    assert load.read_strategy_links(tmp_path / "absent.csv") is None

    actions = load.read_strategy_actions(write(tmp_path / "a.csv", "action_id,action_text\n2.5,Do it\n"))
    assert actions[0]["action_id"] == "2.5" and actions[0]["action_text"] == "Do it"
    assert set(actions[0]) == set(load.STRATEGY_ACTION_COLUMNS)

    links = load.read_strategy_links(write(tmp_path / "l.csv", "indicator_id,action_id,rank\n3621,2.5,1\n3620,2.5,\n"))
    assert [l["rank"] for l in links] == [1, None]
