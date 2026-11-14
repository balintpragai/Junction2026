"""Read the seed inputs from disk into plain rows. No database access.

Inputs:
- `data/raw/sotkanet_regions.json`: the 23 Regions (category HYVINVOINTIALUE).
- `data/curated/indicators.csv`: the indicator registry; one row per indicator,
  naming the processed file (and, for wide files, the column) it comes from.
- `data/curated/known_missing_values.csv`: years known to be missing, stored as
  NULL with a note, never zero and never interpolated.
- `data/processed/*.csv`: the values.
- Optional, loaded when present: `data/curated/region_parent_area.csv`,
  `strategy_action.csv`, `strategy_action_indicator.csv`.

Errors name the file, line and column, never the value, so data stays out of logs.
"""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field, replace
from pathlib import Path

NATIONAL_REGION_CODE = "358"
"""The "Whole country" row in the processed files. Not a Region."""

REGION_CATEGORY = "HYVINVOINTIALUE"
EXPECTED_REGIONS = 23

PATHWAY_STAGES = ("detection", "referral", "treatment_initiation", "outcome", "covariate")

Note = dict[str, str]
"""A data-quality note: {"code": ..., "message": ...}, as common.models.DataQualityNote."""

ECOLOGICAL_FALLACY_NOTE: Note = {
    "code": "ecological_fallacy",
    "message": (
        "Covariates describe a Region as a whole. An association between a covariate and a Gap "
        "across Regions does not show that the same holds for individual people (ecological fallacy)."
    ),
}

MISSING_VALUE_NOTE: Note = {
    "code": "missing_value",
    "message": "No value was published for this year. Missing, not zero; never interpolated.",
}

_MISSING_TOKENS = {"", "nan", "na", "n/a", "null", "none", ".."}

STRATEGY_ACTION_COLUMNS = (
    "action_id", "sub_objective", "goal", "sub_objective_title", "action_text", "action_text_fi",
    "text_status", "translation_note", "fi_verified", "strategy_page", "roadmap_page",
    "responsible", "budget_eur", "budget_note", "milestone_2026_2028", "milestone_2029_2031",
)
STRATEGY_LINK_COLUMNS = ("indicator_id", "action_id", "rank", "link_basis", "source_ref", "source_quote", "note")


class SeedInputError(ValueError):
    """An input file is malformed. The message names the file and line, not the data."""


# --- Rows -------------------------------------------------------------------


@dataclass(frozen=True)
class Region:
    region_id: int
    code: str
    name_en: str
    name_fi: str
    name_sv: str
    kind: str
    parent_area: str | None = None
    parent_area_basis: str | None = None
    parent_area_note: str | None = None


@dataclass(frozen=True)
class IndicatorSpec:
    indicator_id: str
    name: str
    name_fi: str | None
    source: str
    unit: str
    pathway_stage: str
    cancer_type: str | None
    target_value: float | None
    higher_is_better: bool | None
    source_file: str
    source_column: str | None
    """None: long format, rows picked by `indicator_id`, value in `value`. Else the wide column."""
    note: Note | None
    """Added to every row of this indicator."""
    row_note_column: str | None
    """Column whose text, when present, becomes a note on that row."""

    @property
    def has_named_target(self) -> bool:
        return self.target_value is not None

    @property
    def is_covariate(self) -> bool:
        return self.pathway_stage == "covariate"


@dataclass
class FactRow:
    region_code: str
    indicator_id: str
    year: int
    value: float | None
    notes: list[Note] = field(default_factory=list)


@dataclass(frozen=True)
class KnownMissing:
    region_code: str
    indicator_id: str
    year_from: int
    year_to: int
    note: Note


@dataclass(frozen=True)
class LoadReport:
    """Counts only, for the seed log."""

    rows: int
    regions: int
    skipped_non_region_rows: int


# --- Helpers ----------------------------------------------------------------


def normalise_region_code(code: str) -> str:
    """'1' and '01' are the same Region; Sotkanet uses two digits."""
    code = code.strip()
    if code.isdigit() and len(code) < 2:
        return code.zfill(2)
    return code


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        header = [h.strip() for h in (reader.fieldnames or [])]
        reader.fieldnames = header
        return header, list(reader)


def _require_columns(path: Path, header: list[str], columns: tuple[str, ...] | list[str]) -> None:
    missing = [c for c in columns if c not in header]
    if missing:
        raise SeedInputError(f"{path.name}: missing column(s) {', '.join(missing)}")


def parse_number(raw: str | None, where: str) -> float | None:
    """Empty or NaN-like cells are missing (None), never zero."""
    text = (raw or "").strip()
    if text.lower() in _MISSING_TOKENS:
        return None
    try:
        value = float(text)
    except ValueError:
        raise SeedInputError(f"{where}: not a number") from None
    if value != value:  # NaN
        return None
    return value


def parse_year(row: dict[str, str], where: str) -> int:
    """`year`, or the year of `snapshot_date` (Traficom's single snapshot)."""
    if (row.get("year") or "").strip():
        try:
            return int(float(row["year"].strip()))
        except ValueError:
            raise SeedInputError(f"{where}: column year is not a year") from None
    match = re.search(r"\b(19|20)\d{2}\b", row.get("snapshot_date") or "")
    if match:
        return int(match.group(0))
    raise SeedInputError(f"{where}: no year or snapshot_date")


def _parse_bool(raw: str, where: str) -> bool | None:
    text = raw.strip().lower()
    if text == "":
        return None
    if text in {"true", "yes", "1"}:
        return True
    if text in {"false", "no", "0"}:
        return False
    raise SeedInputError(f"{where}: expected true or false")


def _blank_to_none(raw: str | None) -> str | None:
    text = (raw or "").strip()
    return text or None


# --- Regions ----------------------------------------------------------------


def region_kind(code: str) -> str:
    if code == "90":
        return "city_of_helsinki"
    if code == "91":
        return "aland"
    return "wellbeing_services_county"


def read_regions(path: Path) -> list[Region]:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    regions = [
        Region(
            region_id=int(r["id"]),
            code=normalise_region_code(str(r["code"])),
            name_en=r["title"]["en"],
            name_fi=r["title"]["fi"],
            name_sv=r["title"]["sv"],
            kind=region_kind(normalise_region_code(str(r["code"]))),
        )
        for r in raw
        if r.get("category") == REGION_CATEGORY
    ]
    if len(regions) != EXPECTED_REGIONS:
        raise SeedInputError(f"{path.name}: expected {EXPECTED_REGIONS} Regions, found {len(regions)}")
    return sorted(regions, key=lambda r: r.code)


def apply_parent_areas(regions: list[Region], path: Path) -> tuple[list[Region], bool]:
    """Fill `parent_area` from the curated file. Returns (regions, whether the file was there)."""
    if not path.exists():
        return regions, False
    header, rows = read_csv(path)
    _require_columns(path, header, ("region_code", "parent_area"))
    by_code: dict[str, dict[str, str]] = {}
    for line, row in enumerate(rows, start=2):
        code = normalise_region_code(row["region_code"])
        if code in by_code:
            raise SeedInputError(f"{path.name} line {line}: Region code listed twice")
        by_code[code] = row
    known = {r.code for r in regions}
    unknown = sorted(set(by_code) - known)
    if unknown:
        raise SeedInputError(f"{path.name}: unknown Region code(s) {', '.join(unknown)}")
    return [
        replace(
            r,
            parent_area=_blank_to_none(by_code[r.code]["parent_area"]),
            parent_area_basis=_blank_to_none(by_code[r.code].get("basis")),
            parent_area_note=_blank_to_none(by_code[r.code].get("note")),
        )
        if r.code in by_code
        else r
        for r in regions
    ], True


# --- Indicators -------------------------------------------------------------

REGISTRY_COLUMNS = (
    "indicator_id", "name", "name_fi", "source", "unit", "pathway_stage", "cancer_type",
    "target_value", "higher_is_better", "source_file", "source_column", "note_code", "note",
    "row_note_column",
)


def read_indicator_registry(path: Path) -> list[IndicatorSpec]:
    header, rows = read_csv(path)
    _require_columns(path, header, REGISTRY_COLUMNS)
    specs: list[IndicatorSpec] = []
    seen: set[str] = set()
    for line, row in enumerate(rows, start=2):
        where = f"{path.name} line {line}"
        indicator_id = row["indicator_id"].strip()
        if not indicator_id:
            raise SeedInputError(f"{where}: empty indicator_id")
        if indicator_id in seen:
            raise SeedInputError(f"{where}: indicator {indicator_id} listed twice")
        seen.add(indicator_id)

        stage = row["pathway_stage"].strip()
        if stage not in PATHWAY_STAGES:
            raise SeedInputError(f"{where}: pathway_stage must be one of {', '.join(PATHWAY_STAGES)}")
        higher_is_better = _parse_bool(row["higher_is_better"], f"{where}, higher_is_better")
        if stage != "covariate" and higher_is_better is None:
            raise SeedInputError(f"{where}: higher_is_better is required unless pathway_stage is covariate")
        for column in ("name", "source", "unit", "source_file"):
            if not row[column].strip():
                raise SeedInputError(f"{where}: empty {column}")

        note_code, note_text = row["note_code"].strip(), row["note"].strip()
        if bool(note_code) != bool(note_text):
            raise SeedInputError(f"{where}: note_code and note go together")

        specs.append(
            IndicatorSpec(
                indicator_id=indicator_id,
                name=row["name"].strip(),
                name_fi=_blank_to_none(row["name_fi"]),
                source=row["source"].strip(),
                unit=row["unit"].strip(),
                pathway_stage=stage,
                cancer_type=_blank_to_none(row["cancer_type"]),
                target_value=parse_number(row["target_value"], f"{where}, target_value"),
                higher_is_better=higher_is_better,
                source_file=row["source_file"].strip(),
                source_column=_blank_to_none(row["source_column"]),
                note={"code": note_code, "message": note_text} if note_code else None,
                row_note_column=_blank_to_none(row["row_note_column"]),
            )
        )
    return specs


def read_indicator_values(
    spec: IndicatorSpec, processed_dir: Path, region_codes: set[str]
) -> tuple[list[FactRow], LoadReport]:
    """One indicator's values for the 23 Regions. Other rows (the "Whole country") are counted and skipped."""
    path = processed_dir / spec.source_file
    header, rows = read_csv(path)
    value_column = spec.source_column or "value"
    needed = ["region_code", value_column]
    if spec.source_column is None:
        needed.append("indicator_id")
    if spec.row_note_column:
        needed.append(spec.row_note_column)
    if "year" not in header and "snapshot_date" not in header:
        needed.append("year")
    _require_columns(path, header, needed)

    facts: list[FactRow] = []
    seen: set[tuple[str, int]] = set()
    skipped = 0
    for line, row in enumerate(rows, start=2):
        where = f"{path.name} line {line}"
        if spec.source_column is None and row["indicator_id"].strip() != spec.indicator_id:
            continue
        code = normalise_region_code(row["region_code"])
        if code not in region_codes:
            skipped += 1
            continue
        year = parse_year(row, where)
        if (code, year) in seen:
            raise SeedInputError(f"{where}: second value for the same Region and year (indicator {spec.indicator_id})")
        seen.add((code, year))

        value = parse_number(row[value_column], f"{where}, column {value_column}")
        notes: list[Note] = []
        if value is None:
            notes.append(dict(MISSING_VALUE_NOTE))
        if spec.note:
            notes.append(dict(spec.note))
        if spec.row_note_column and row[spec.row_note_column].strip():
            notes.append({"code": spec.row_note_column, "message": row[spec.row_note_column].strip()})
        if spec.is_covariate:
            notes.append(dict(ECOLOGICAL_FALLACY_NOTE))
        facts.append(FactRow(code, spec.indicator_id, year, value, notes))

    if not facts:
        raise SeedInputError(f"{path.name}: no rows for indicator {spec.indicator_id} matched the 23 Regions")
    report = LoadReport(rows=len(facts), regions=len({f.region_code for f in facts}), skipped_non_region_rows=skipped)
    return facts, report


# --- Known missing values ---------------------------------------------------


def read_known_missing(path: Path) -> list[KnownMissing]:
    header, rows = read_csv(path)
    _require_columns(path, header, ("region_code", "indicator_id", "year_from", "year_to", "note_code", "note"))
    out: list[KnownMissing] = []
    for line, row in enumerate(rows, start=2):
        where = f"{path.name} line {line}"
        try:
            year_from, year_to = int(row["year_from"]), int(row["year_to"])
        except ValueError:
            raise SeedInputError(f"{where}: year_from and year_to must be years") from None
        if year_to < year_from or not row["note_code"].strip() or not row["note"].strip():
            raise SeedInputError(f"{where}: needs year_from <= year_to, a note_code and a note")
        out.append(
            KnownMissing(
                region_code=normalise_region_code(row["region_code"]),
                indicator_id=row["indicator_id"].strip(),
                year_from=year_from,
                year_to=year_to,
                note={"code": row["note_code"].strip(), "message": row["note"].strip()},
            )
        )
    return out


@dataclass(frozen=True)
class KnownMissingReport:
    nulled: int
    """Rows that had a value in the file and were set to NULL. Should be 0."""
    added: int
    """Missing years added as NULL rows so the note has somewhere to live."""
    already_null: int


def apply_known_missing(
    facts: list[FactRow], known: list[KnownMissing], region_codes: set[str]
) -> KnownMissingReport:
    """Store each known-missing year as value NULL with its note, in place.

    A value in the file for such a year is overridden (and counted), because these
    years are documented as missing: storing a zero would read as a real result.
    """
    by_key = {(f.region_code, f.indicator_id, f.year): f for f in facts}
    loaded_indicators = {f.indicator_id for f in facts}
    nulled = added = already_null = 0
    for km in known:
        if km.region_code not in region_codes:
            raise SeedInputError(f"known missing values: unknown Region code {km.region_code}")
        if km.indicator_id not in loaded_indicators:
            raise SeedInputError(f"known missing values: indicator {km.indicator_id} is not loaded")
        for year in range(km.year_from, km.year_to + 1):
            fact = by_key.get((km.region_code, km.indicator_id, year))
            if fact is None:
                fact = FactRow(km.region_code, km.indicator_id, year, None, [])
                facts.append(fact)
                by_key[(km.region_code, km.indicator_id, year)] = fact
                added += 1
            elif fact.value is not None:
                nulled += 1
            else:
                already_null += 1
            fact.value = None
            fact.notes = [km.note] + [n for n in fact.notes if n["code"] != MISSING_VALUE_NOTE["code"]]
    return KnownMissingReport(nulled=nulled, added=added, already_null=already_null)


# --- Strategy actions (optional) --------------------------------------------


def read_strategy_actions(path: Path) -> list[dict[str, str | None]] | None:
    if not path.exists():
        return None
    header, rows = read_csv(path)
    _require_columns(path, header, ("action_id",))
    out = []
    seen: set[str] = set()
    for line, row in enumerate(rows, start=2):
        action_id = row["action_id"].strip()
        if not action_id:
            raise SeedInputError(f"{path.name} line {line}: empty action_id")
        if action_id in seen:
            raise SeedInputError(f"{path.name} line {line}: action {action_id} listed twice")
        seen.add(action_id)
        out.append({c: (action_id if c == "action_id" else _blank_to_none(row.get(c))) for c in STRATEGY_ACTION_COLUMNS})
    return out


def read_strategy_links(path: Path) -> list[dict[str, str | int | None]] | None:
    if not path.exists():
        return None
    header, rows = read_csv(path)
    _require_columns(path, header, ("indicator_id", "action_id"))
    out = []
    seen: set[tuple[str, str]] = set()
    for line, row in enumerate(rows, start=2):
        where = f"{path.name} line {line}"
        key = (row["indicator_id"].strip(), row["action_id"].strip())
        if not all(key):
            raise SeedInputError(f"{where}: indicator_id and action_id are required")
        if key in seen:
            raise SeedInputError(f"{where}: the same indicator and action are linked twice")
        seen.add(key)
        rank_text = (row.get("rank") or "").strip()
        try:
            rank = int(rank_text) if rank_text else None
        except ValueError:
            raise SeedInputError(f"{where}: rank must be a whole number") from None
        link: dict[str, str | int | None] = {c: _blank_to_none(row.get(c)) for c in STRATEGY_LINK_COLUMNS}
        link.update(indicator_id=key[0], action_id=key[1], rank=rank)
        out.append(link)
    return out
