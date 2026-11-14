#!/usr/bin/env python3
"""Extract screening-funnel tables from a Finnish Cancer Registry annual report.

The annual reports at https://stats.cancerregistry.fi/joukkistilastot/<cancer>.html
render their screening-process breakdowns as server-side kableExtra HTML <table>s
with exact N and % columns. This script extracts three of those breakdowns:

  wellbeing_county  -- "Wellbeing services counties" > "Screening process"
  native_language   -- "Population groups" > "Native language"
  region_of_birth   -- "Population groups" > "Region of birth"

and writes one CSV per breakdown to <out_dir>, named
<cancer>_<dimension>_funnel_<firstYear>_<lastYear>.csv.

Values are copied exactly as published (no re-rounding, '–' kept as is). Rows
are ordered most recent year first, then in the report's own table order.

Usage:
    python scripts/extract_cancerregistry_funnels.py <report.html> <cancer> <out_dir>

    <cancer> is one of: breast, cervix, colorectal

Standard library only. Exits non-zero if a table's header does not match the
expected funnel stages for <cancer> (i.e. the report layout changed).
"""

import csv
import os
import re
import sys
from html.parser import HTMLParser

# Funnel stages per programme: (header label as printed, column prefix,
# prefix of the stage the % is computed from -- used only for the sanity check).
STAGES = {
    "breast": [
        ("Invited", "invited", None),
        ("Attended (of invited)", "attended", "invited"),
        ("Invitation to diagnostic examinations (of attendees)", "invited_diagnostics", "attended"),
        ("Referral to specialized healthcare (of examined)", "referred_specialized", "invited_diagnostics"),
    ],
    "cervix": [
        ("Invited", "invited", None),
        ("Attended (of invited)", "attended", "invited"),
        ("Follow-up recommendation (of those who participated)", "followup_recommended", "attended"),
        ("Referral to colposcopy (of those who participated)", "referred_colposcopy", "attended"),
        ("Attended colposcopy (of those referred)", "attended_colposcopy", "referred_colposcopy"),
        ("Histological HSIL or worse (of those who had colposcopy)", "hsil_or_worse", "attended_colposcopy"),
    ],
    "colorectal": [
        ("Picked", "picked", None),
        ("Attended", "attended", "picked"),
        ("Test positives", "test_positive", "attended"),
        ("Attended colonoscopy (of test positives)", "attended_colonoscopy", "test_positive"),
        ("Surgical/neoadjuvant treatment (of those who had colonoscopy)", "surgical_neoadjuvant_treatment", "attended_colonoscopy"),
    ],
}

# dimension -> (h2 text, h3 text, first header cell as printed)
DIMENSIONS = {
    "wellbeing_county": ("Wellbeing services counties", "Screening process", "Wellbeing service county"),
    "native_language": ("Population groups", "Native language", "Native language"),
    "region_of_birth": ("Population groups", "Region of birth", "Region of birth"),
}

# Extra grouping columns some tables carry before the funnel stages.
EXTRA_GROUP_COLUMNS = {"Sex": "sex"}

MISSING = "–"  # en dash, as printed by the report for undefined percentages


def norm(text):
    return " ".join(text.split())


class ReportParser(HTMLParser):
    """Collects every top-level <table> with its h2/h3/h4 and <strong> label context."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.headings = {}
        self.label = ""  # last <strong> text since the last heading
        self.tables = []
        self._heading_level = None
        self._strong = False
        self._buf = []
        self._table_depth = 0
        self._row = None
        self._cell = None
        self._colspan = 1

    def handle_starttag(self, tag, attrs):
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._heading_level = int(tag[1])
            self._buf = []
        elif tag == "strong" and not self._table_depth:
            self._strong = True
            self._buf = []
        elif tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                self.tables.append({
                    "h2": self.headings.get(2, ""),
                    "h3": self.headings.get(3, ""),
                    "h4": self.headings.get(4, ""),
                    "label": self.label,
                    "rows": [],
                })
        elif self._table_depth == 1 and tag == "tr":
            self._row = []
        elif self._table_depth == 1 and tag in ("td", "th"):
            self._cell = []
            self._colspan = int(dict(attrs).get("colspan") or 1)

    def handle_endtag(self, tag):
        if self._heading_level and tag == f"h{self._heading_level}":
            level = self._heading_level
            self.headings[level] = norm("".join(self._buf))
            for deeper in [k for k in self.headings if k > level]:
                del self.headings[deeper]
            self.label = ""
            self._heading_level = None
        elif tag == "strong" and self._strong:
            self.label = norm("".join(self._buf))
            self._strong = False
        elif tag == "table":
            self._table_depth -= 1
        elif self._table_depth == 1 and tag in ("td", "th") and self._cell is not None:
            self._row.append((norm("".join(self._cell)), self._colspan))
            self._cell = None
        elif self._table_depth == 1 and tag == "tr" and self._row is not None:
            self.tables[-1]["rows"].append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._heading_level or self._strong:
            self._buf.append(data)
        if self._cell is not None:
            self._cell.append(data)


def snake(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def parse_table(table, cancer, dimension):
    """Return (group_columns, value_columns, data_rows) for one funnel table."""
    _, _, first_header = DIMENSIONS[dimension]
    stages = STAGES[cancer]
    top, sub, *body = table["rows"]

    labels = [text for text, _ in top]
    spans = [span for _, span in top]
    if labels[0] != first_header:
        raise ValueError(f"expected first header {first_header!r}, got {labels[0]!r}")

    group_columns = [dimension]
    i = 1
    while labels[i] in EXTRA_GROUP_COLUMNS:
        group_columns.append(EXTRA_GROUP_COLUMNS[labels[i]])
        i += 1

    expected = [label for label, _, _ in stages]
    if labels[i:] != expected:
        raise ValueError(f"funnel stages changed: expected {expected}, got {labels[i:]}")

    unit_iter = iter(text for text, _ in sub[len(group_columns):])
    value_columns = []
    for (_, prefix, _), span in zip(stages, spans[i:]):
        for _ in range(span):
            unit = next(unit_iter)
            suffix = {"N": "n", "%": "pct"}.get(unit)
            if suffix is None:
                raise ValueError(f"unexpected unit {unit!r} under stage {prefix!r}")
            value_columns.append(f"{prefix}_{suffix}")

    width = len(group_columns) + len(value_columns)
    rows = []
    for cells in body:
        values = [text for text, _ in cells]
        if len(values) != width:
            raise ValueError(f"row has {len(values)} cells, expected {width}: {values}")
        for col, val in zip(value_columns, values[len(group_columns):]):
            if col.endswith("_n") and not val.isdigit():
                raise ValueError(f"non-integer count {val!r} in {col}")
        rows.append(values)
    return group_columns, value_columns, rows


def check_percentages(cancer, header, rows):
    """Warn where a printed % differs from N / denominator N by more than rounding."""
    denominators = {prefix: denom for _, prefix, denom in STAGES[cancer]}
    idx = {col: k for k, col in enumerate(header)}
    problems = []
    for row in rows:
        for col in header:
            if not col.endswith("_pct"):
                continue
            prefix = col[: -len("_pct")]
            denom = denominators[prefix]
            pct, n, d = row[idx[col]], row[idx[prefix + "_n"]], row[idx[denom + "_n"]]
            if pct == MISSING:
                if d != "0":
                    problems.append((row, col, f"'{MISSING}' but denominator {d}"))
                continue
            if d == "0":
                continue
            expected = int(n) / int(d) * 100
            if abs(expected - float(pct)) > 0.05 + 1e-9:
                problems.append((row, col, f"printed {pct}, computed {expected:.3f}"))
    return problems


def extract(html_path, cancer, out_dir):
    with open(html_path, encoding="utf-8") as fh:
        parser = ReportParser()
        parser.feed(fh.read())

    written = []
    for dimension, (h2, h3, _) in DIMENSIONS.items():
        matches = [t for t in parser.tables if t["h2"] == h2 and t["h3"] == h3]
        if not matches:
            print(f"[{cancer}] {dimension}: no table found", file=sys.stderr)
            continue

        with_label = any(t["label"] for t in matches)
        header = None
        by_year = {}
        for table in matches:
            year = table["h4"]
            if not re.fullmatch(r"\d{4}", year):
                raise ValueError(f"{dimension}: unexpected tab heading {year!r}")
            group_columns, value_columns, rows = parse_table(table, cancer, dimension)
            prefix_columns = ["year"] + (["screening_group"] if with_label else [])
            this_header = prefix_columns + group_columns + value_columns
            if header is None:
                header = this_header
            elif header != this_header:
                raise ValueError(f"{dimension} {year}: columns differ from other years")
            prefix_values = [year] + ([table["label"]] if with_label else [])
            by_year.setdefault(year, []).extend(prefix_values + r for r in rows)

        years = sorted(by_year, reverse=True)
        out_rows = [row for year in years for row in by_year[year]]
        name = f"{cancer}_{dimension}_funnel_{years[-1]}_{years[0]}.csv"
        path = os.path.join(out_dir, name)
        with open(path, "w", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh, lineterminator="\n")
            writer.writerow(header)
            writer.writerows(out_rows)
        written.append(path)
        print(f"[{cancer}] {dimension}: {len(out_rows)} rows, {years[-1]}-{years[0]} -> {path}")

        for row, col, msg in check_percentages(cancer, header, out_rows):
            print(f"  WARNING {col} {msg}: {row}", file=sys.stderr)
    return written


def main(argv):
    if len(argv) != 4 or argv[2] not in STAGES:
        sys.exit(__doc__)
    html_path, cancer, out_dir = argv[1:]
    os.makedirs(out_dir, exist_ok=True)
    extract(html_path, cancer, out_dir)


if __name__ == "__main__":
    main(sys.argv)
