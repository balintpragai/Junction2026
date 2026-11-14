"""Rebuild sotkanet_values.json from the processed Sotkanet data.

Run from the repo root:  python engine/tests/fixtures/build_fixture.py

The fixture is frozen on purpose: a data refresh must not change what the
scoring tests assert. Rebuild it only when you mean to update the tests too.
"""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "data/processed/combined_cancer_indicators_by_wellbeing_county.csv"
OUT = Path(__file__).with_name("sotkanet_values.json")

INDICATORS = ["3336", "3620", "3621", "5033", "6103"]
WHOLE_COUNTRY = "358"  # national row, not a Region


def main() -> None:
    indicators: dict[str, dict] = {}
    with open(SOURCE, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ind, code = row["indicator_id"], row["region_code"]
            if ind not in INDICATORS or code == WHOLE_COUNTRY:
                continue
            entry = indicators.setdefault(ind, {"name": row["indicator_name"], "values": {}})
            entry["values"].setdefault(code, {})[row["year"]] = float(row["value"])

    for entry in indicators.values():
        entry["values"] = {
            code: dict(sorted(series.items())) for code, series in sorted(entry["values"].items())
        }
    fixture = {
        "source": f"{SOURCE.relative_to(ROOT).as_posix()}, Regions only (Whole country row {WHOLE_COUNTRY} dropped)",
        "indicators": dict(sorted(indicators.items(), key=lambda kv: int(kv[0]))),
    }
    OUT.write_text(json.dumps(fixture, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
