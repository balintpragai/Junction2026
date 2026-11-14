"""Build the Statistics Finland covariate files for every year (issue #50).

Two steps, so the processed files can be rebuilt without the network:

    python scripts/build_statfin_covariates.py fetch   # StatFin PxWeb -> data/raw/statfin_*.json
    python scripts/build_statfin_covariates.py build   # data/raw -> data/processed/covariates_*.csv

Method (the one `research/covariate_correlation_analysis.md` describes):
municipality figures are aggregated to the 23 Regions through each municipality's
`memberOf` link to a HYVINVOINTIALUE in `data/raw/sotkanet_regions.json`, matched on the
municipality code (Sotkanet `005` = StatFin `KU005`). Rates are population-weighted
averages of the municipal rates, weighted by "Dwelling population, persons" (income and
poverty). Immigrant-background shares are computed from counts instead (persons ÷
"Population 31 Dec"), which is the same weighting without the rounding of StatFin's
one-decimal municipal shares. A median can't be aggregated
exactly, so the Region's median income is the dwelling-population-weighted average of
the municipal medians, as before.
"""

from __future__ import annotations

import csv
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
REGIONS_FILE = RAW / "sotkanet_regions.json"

API = "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/"
USER_AGENT = "reach-loop-data-pipeline"
FIRST_YEAR = 2016  # first year of the scored indicators

TABLES = {
    "159t": {
        "path": "vaerak/159t.px",
        "raw": "statfin_159t_immigrant_background_by_municipality.json",
        "out": "covariates_immigrant_background_by_wellbeing_county.csv",
        "weight": ("vaerak-vaesto", "population"),
        # Shares are summed counts over summed population: exact, unlike averaging
        # StatFin's municipal shares, which are published with one decimal.
        "shares": [
            ("vaesto_kieli_ulk", "pct_foreign_language_speakers", 2),
            ("vaesto_tausta_ulk", "pct_foreign_background", 2),
        ],
        "rates": [],
    },
    "14ww": {
        "path": "tjt/14ww.px",
        "raw": "statfin_14ww_income_poverty_by_municipality.json",
        "out": "covariates_income_poverty_by_wellbeing_county.csv",
        "weight": ("tjt-henkiloita", "dwelling_population"),
        "shares": [],
        # (StatFin content code, output column, decimals): weighted average of municipal values
        "rates": [
            ("tjt-ekvikturaha_med", "median_disposable_income_eur_per_consumption_unit", 0),
            ("rpt_aste", "at_risk_of_poverty_rate_pct", 2),
        ],
    },
}


def _request(url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)


def fetch() -> None:
    for spec in TABLES.values():
        meta = _request(API + spec["path"])
        variables = {v["code"]: v for v in meta["variables"]}
        area = next(code for code in variables if code.startswith("alue"))
        years = [y for y in variables["timeperiod_y"]["values"] if int(y) >= FIRST_YEAR]
        municipalities = [c for c in variables[area]["values"] if c.startswith("KU")]
        contents = [spec["weight"][0]] + [code for code, _, _ in spec["shares"] + spec["rates"]]
        body = {
            "query": [
                {"code": area, "selection": {"filter": "item", "values": municipalities}},
                {"code": "timeperiod_y", "selection": {"filter": "item", "values": years}},
                {"code": "contentscode", "selection": {"filter": "item", "values": contents}},
            ],
            "response": {"format": "json-stat2"},
        }
        data = _request(API + spec["path"], body)
        out = RAW / spec["raw"]
        out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{spec['path']}: {len(municipalities)} municipalities, years {years[0]}-{years[-1]} -> {out.relative_to(ROOT)}")


def _cells(data: dict) -> dict[tuple[str, ...], float | None]:
    """json-stat2 -> {(value code per dimension, in `id` order): value}."""
    dims = data["id"]
    codes = []
    for d in dims:
        index = data["dimension"][d]["category"]["index"]
        codes.append(sorted(index, key=index.get) if isinstance(index, dict) else index)
    out: dict[tuple[str, ...], float | None] = {}
    for flat, value in enumerate(data["value"]):
        key, rest = [], flat
        for size, dim_codes in zip(reversed(data["size"]), reversed(codes)):
            key.append(dim_codes[rest % size])
            rest //= size
        out[tuple(reversed(key))] = value
    return out


def _regions() -> tuple[dict[str, tuple[str, str]], list[tuple[str, str]]]:
    """municipality code (3 digits) -> (Region code, Region name), and the 23 Regions in code order."""
    raw = json.loads(REGIONS_FILE.read_text(encoding="utf-8"))
    by_id = {r["id"]: r for r in raw}
    regions = {r["id"]: (r["code"], r["title"]["en"]) for r in raw if r["category"] == "HYVINVOINTIALUE"}
    municipality_region: dict[str, tuple[str, str]] = {}
    for r in raw:
        if r["category"] != "KUNTA":
            continue
        parents = [regions[m] for m in r["memberOf"] if m in by_id and m in regions]
        if len(parents) != 1:
            raise SystemExit(f"municipality {r['code']} {r['title']['fi']}: expected one Region, found {len(parents)}")
        municipality_region[r["code"]] = parents[0]
    return municipality_region, sorted(set(regions.values()))


def build() -> None:
    municipality_region, regions = _regions()
    for spec in TABLES.values():
        data = json.loads((RAW / spec["raw"]).read_text(encoding="utf-8"))
        dims = data["id"]
        area = next(d for d in dims if d.startswith("alue"))
        cells = _cells(data)
        pos = {d: i for i, d in enumerate(dims)}
        years = sorted({k[pos["timeperiod_y"]] for k in cells})
        municipalities = sorted({k[pos[area]] for k in cells})

        unmatched = sorted({m for m in municipalities if m.removeprefix("KU") not in municipality_region})
        missing = sorted(set(municipality_region) - {m.removeprefix("KU") for m in municipalities})
        if unmatched or missing:
            raise SystemExit(f"{spec['path']}: municipality mismatch, not in Sotkanet {unmatched}, not in StatFin {missing}")

        def cell(m: str, year: str, content: str) -> float | None:
            key = [None] * len(dims)
            key[pos[area]], key[pos["timeperiod_y"]], key[pos["contentscode"]] = m, year, content
            return cells.get(tuple(key))

        weight_code, weight_column = spec["weight"]
        header = ["region_code", "region_name_en", "year", weight_column]
        header += [col for _, col, _ in spec["shares"] + spec["rates"]]
        rows = []
        for year in years:
            for region_code, region_name in regions:
                members = [m for m in municipalities if municipality_region[m.removeprefix("KU")][0] == region_code]
                weights = [cell(m, year, weight_code) for m in members]
                if any(w is None for w in weights):
                    raise SystemExit(f"{spec['path']}: Region {region_code} {year}: a municipality has no {weight_code}")
                total = sum(weights)
                row = [region_code, region_name, year, int(total)]
                for content, _, decimals in spec["shares"]:
                    counts = [cell(m, year, content) for m in members]
                    if any(c is None for c in counts):
                        raise SystemExit(f"{spec['path']}: Region {region_code} {year}: a municipality has no {content}")
                    row.append(round(100 * sum(counts) / total, decimals))
                for content, _, decimals in spec["rates"]:
                    pairs = [(cell(m, year, content), cell(m, year, weight_code)) for m in members]
                    pairs = [(v, w) for v, w in pairs if v is not None and w]
                    if not pairs:
                        row.append("")
                        continue
                    value = sum(v * w for v, w in pairs) / sum(w for _, w in pairs)
                    row.append(f"{round(value, decimals):.1f}" if decimals == 0 else round(value, decimals))
                rows.append(row)
        out = PROCESSED / spec["out"]
        with open(out, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f, lineterminator="\n")
            writer.writerow(header)
            writer.writerows(rows)
        print(f"{out.relative_to(ROOT)}: {len(rows)} rows, {len(regions)} Regions x years {years[0]}-{years[-1]}")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"fetch", "build"}:
        raise SystemExit(__doc__)
    {"fetch": fetch, "build": build}[sys.argv[1]]()
