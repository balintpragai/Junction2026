"""Zero-dependency mock of a richer `api` — for visually testing the new
map -> region profile -> action planner pipeline the user sketched, against
real multi-indicator data, without Docker/Postgres. Ports the real logic in
this repo (engine/app/scoring.py's severity thresholds incl. the z-score
branch for untargeted indicators, common/template.py's EN wording,
data/curated/'s real strategy-action matches and region_parent_area.csv's
real peer groups) and layers one genuinely new thing on top: a
`/regions/{code}/profile` endpoint and a deterministic, rule-based
candidate-action list — neither exists in the real api yet; this is a
product-direction mock, documented as such.
Not part of the actual system — throwaway, scratchpad only.
"""
import csv
import json
import statistics
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SCRATCH = Path(__file__).parent

REGIONS = [
    ("helsinki", "City of Helsinki", "city_of_helsinki", "90"),
    ("ita-uusimaa", "East Uusimaa wellbeing services county", "wellbeing_services_county", "01"),
    ("keski-uusimaa", "Central Uusimaa wellbeing services county", "wellbeing_services_county", "02"),
    ("lansi-uusimaa", "West Uusimaa wellbeing services county", "wellbeing_services_county", "03"),
    ("vantaa-kerava", "Vantaa and Kerava wellbeing services county", "wellbeing_services_county", "04"),
    ("varsinais-suomi", "Southwest Finland wellbeing services county", "wellbeing_services_county", "05"),
    ("satakunta", "Satakunta wellbeing services county", "wellbeing_services_county", "06"),
    ("kanta-hame", "Kanta-Hame wellbeing services county", "wellbeing_services_county", "07"),
    ("pirkanmaa", "Pirkanmaa wellbeing services county", "wellbeing_services_county", "08"),
    ("paijat-hame", "Paijat-Hame wellbeing services county", "wellbeing_services_county", "09"),
    ("kymenlaakso", "Kymenlaakso wellbeing services county", "wellbeing_services_county", "10"),
    ("etela-karjala", "South Karelia wellbeing services county", "wellbeing_services_county", "11"),
    ("etela-savo", "South Savo wellbeing services county", "wellbeing_services_county", "12"),
    ("pohjois-savo", "North Savo wellbeing services county", "wellbeing_services_county", "13"),
    ("pohjois-karjala", "North Karelia wellbeing services county", "wellbeing_services_county", "14"),
    ("keski-suomi", "Central Finland wellbeing services county", "wellbeing_services_county", "15"),
    ("etela-pohjanmaa", "South Ostrobothnia wellbeing services county", "wellbeing_services_county", "16"),
    ("pohjanmaa", "Ostrobothnia wellbeing services county", "wellbeing_services_county", "17"),
    ("keski-pohjanmaa", "Central Ostrobothnia wellbeing services county", "wellbeing_services_county", "18"),
    ("pohjois-pohjanmaa", "North Ostrobothnia wellbeing services county", "wellbeing_services_county", "19"),
    ("kainuu", "Kainuu wellbeing services county", "wellbeing_services_county", "20"),
    ("lappi", "Lapland wellbeing services county", "wellbeing_services_county", "21"),
    ("aland", "Aland", "aland", "91"),
]
CODE_FROM_TWO_DIGIT = {two: code for code, _, _, two in REGIONS}
NAME = {code: name for code, name, _, _ in REGIONS}
KIND = {code: kind for code, _, kind, _ in REGIONS}
ALL_CODES = [c for c, _, _, _ in REGIONS]

YEAR = 2024
WATCH_MAX_SHORTFALL = 3.0  # engine/app/severity_thresholds.toml [targeted]
WATCH_Z, ACT_Z = 1.0, 1.5  # engine/app/severity_thresholds.toml [untargeted]

# --- indicator values: real 2024 numbers -------------------------------------

VALUES_3621 = {
    "helsinki": 74.3, "ita-uusimaa": 84.1, "keski-uusimaa": 82.6, "lansi-uusimaa": 80.9,
    "vantaa-kerava": 73.2, "varsinais-suomi": 85.0, "satakunta": 86.2, "kanta-hame": 84.7,
    "pirkanmaa": 83.9, "paijat-hame": 81.5, "kymenlaakso": 82.2, "etela-karjala": 85.6,
    "etela-savo": 86.8, "pohjois-savo": 87.1, "pohjois-karjala": 86.4, "keski-suomi": 84.3,
    "etela-pohjanmaa": 88.0, "pohjanmaa": 85.9, "keski-pohjanmaa": 87.5, "pohjois-pohjanmaa": 83.1,
    "kainuu": 86.0, "lappi": 79.4, "aland": 70.8,
}
_multi = json.loads((SCRATCH / "multi_indicator.json").read_text())
_cov = json.loads((SCRATCH / "covariates.json").read_text())

INDICATORS = {
    "3621": {"name": "Breast cancer screening attendance", "unit": "%", "target": 80.0,
             "higher_is_better": True, "values": VALUES_3621, "cancer_type": "breast"},
    "3620": {"name": "Cervical cancer screening attendance", "unit": "%", "target": 80.0,
             "higher_is_better": True, "values": _multi["3620"], "cancer_type": "cervical"},
    "6103": {"name": "Colorectal cancer screening attendance", "unit": "%", "target": 80.0,
             "higher_is_better": True, "values": _multi["6103"], "cancer_type": "colorectal"},
    "3336": {"name": "Patients waiting over 6 months for specialised care", "unit": "per 10 000 inhabitants",
              "target": None, "higher_is_better": False, "values": _multi["3336"], "cancer_type": None},
    "13": {"name": "Referrals processed within 3 days", "unit": "% of referrals received",
           "target": None, "higher_is_better": True, "values": _multi["13"], "cancer_type": None},
}
GAP_INDICATOR_ORDER = ["3621", "3620", "6103", "3336", "13"]

COVARIATES = {
    "immigrant_background_pct": {"name": "People with a foreign background", "unit": "%", "values": _cov["immigrant"]},
    "kela_travel_eur_per_capita": {"name": "Kela medical-travel reimbursement", "unit": "EUR per capita", "values": _cov["travel"]},
    "broadband_gigabit_pct": {"name": "Gigabit broadband available", "unit": "% of households", "values": _cov["broadband"]},
}
MEDIAN = {k: statistics.median(v["values"].values()) for k, v in COVARIATES.items()}


def load_parent_areas() -> dict[str, str]:
    out = {}
    with open(REPO / "data/curated/region_parent_area.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = CODE_FROM_TWO_DIGIT.get(row["region_code"])
            if code:
                out[code] = row["parent_area"]
    return out


def load_strategy_actions() -> tuple[dict[str, dict], dict[str, list[dict]]]:
    actions = {}
    with open(REPO / "data/curated/strategy_action.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            actions[row["action_id"]] = row
    links: dict[str, list[dict]] = {}
    with open(REPO / "data/curated/strategy_action_indicator.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            links.setdefault(row["indicator_id"], []).append(row)
    for v in links.values():
        v.sort(key=lambda r: int(r["rank"]))
    return actions, links


PARENT_AREA = load_parent_areas()
STRATEGY_ACTIONS, STRATEGY_LINKS = load_strategy_actions()


def fmt(x: float) -> str:
    return f"{x:.2f}".rstrip("0").rstrip(".")


def target_severity(value: float, target: float, higher_is_better: bool) -> str:
    shortfall = target - value if higher_is_better else value - target
    if shortfall <= 0:
        return "ok"
    if shortfall <= WATCH_MAX_SHORTFALL:
        return "watch"
    return "act"


def z_score_severity(value: float, others: list[float], higher_is_better: bool) -> tuple[float, str]:
    """engine/app/scoring.py:_z_score_severity, ported verbatim."""
    reference = statistics.median(others)
    spread = statistics.pstdev(others) if len(others) >= 2 else 0.0
    if spread <= 1e-9:
        return reference, "ok"
    z = (value - statistics.fmean(others)) / spread
    z_bad = -z if higher_is_better else z
    if z_bad >= ACT_Z:
        return reference, "act"
    if z_bad >= WATCH_Z:
        return reference, "watch"
    return reference, "ok"


def score_indicator(indicator_id: str, code: str) -> dict | None:
    meta = INDICATORS[indicator_id]
    values: dict[str, float] = meta["values"]
    if code not in values:
        return None
    value = values[code]
    higher = meta["higher_is_better"]
    others = [v for c, v in values.items() if c != code]
    notes = []

    if meta["target"] is not None:
        reference_kind, reference_value = "target", meta["target"]
        severity = target_severity(value, reference_value, higher)
    else:
        reference_kind = "peer_median"
        reference_value, severity = z_score_severity(value, others, higher)

    deviation = round(value - reference_value, 2)
    direction = "below" if deviation < -1e-9 else ("above" if deviation > 1e-9 else "at")
    ranked = sorted(values.items(), key=lambda kv: kv[1] if not higher else -kv[1])
    rank = [c for c, _ in ranked].index(code) + 1

    area = PARENT_AREA.get(code)
    peer_codes = [c for c in values if c != code and PARENT_AREA.get(c) == area]
    peer_values = [{"region_code": code, "value": value}] + [{"region_code": c, "value": values[c]} for c in peer_codes]
    if not peer_codes:
        notes.append({"code": "no_peers", "message": "No peer Regions to compare with."})

    sentence = template_sentence(NAME[code], meta["name"], meta["unit"], value, reference_kind, reference_value, deviation, direction, rank, len(values))

    return {
        "indicator": {"code": indicator_id, "name": meta["name"], "unit": meta["unit"],
                      "higher_is_better": higher, "target": meta["target"], "years": [YEAR]},
        "gap": {
            "region_code": code, "indicator_code": indicator_id, "year": YEAR, "value": value,
            "reference_kind": reference_kind, "reference_value": round(reference_value, 2), "deviation": deviation,
            "direction": direction, "severity": severity, "rank": rank, "n_regions": len(values),
            "peer_values": peer_values,
        },
        "narrative": {"text": sentence, "source": "template", "language": "en"},
        "data_quality_notes": notes,
    }


def template_sentence(name, indicator_name, unit, value, reference_kind, reference_value, deviation, direction, rank, n) -> str:
    """common/template.py's EN wording, ported."""
    low = indicator_name[0].lower() + indicator_name[1:]
    ref_label = "target" if reference_kind == "target" else "median"
    unit_s = "%" if unit.strip().startswith("%") else f" {unit}"
    dev_unit = "pp" if unit.strip().startswith("%") else unit
    if direction == "at":
        return f"{name} is at the {fmt(reference_value)}{unit_s} {ref_label} for {low} in {YEAR}, ranking {rank} of {n}."
    return (
        f"{name} is {fmt(abs(deviation))} {dev_unit} {direction} the {fmt(reference_value)}{unit_s} "
        f"{ref_label} for {low} in {YEAR}, ranking {rank} of {n}."
    )


def strategy_source(action: dict, link: dict | None = None) -> str:
    base = f"National Cancer Strategy 2026-2035, p.{action['strategy_page']} (action {action['action_id']})"
    if link:
        return f"{base} — linked via {link['source_ref']}: \"{link['source_quote']}\""
    return base


def matched_action(indicator_id: str) -> dict | None:
    links = STRATEGY_LINKS.get(indicator_id)
    if not links:
        return None
    top = links[0]
    action = STRATEGY_ACTIONS[top["action_id"]]
    return {
        "id": action["action_id"],
        # The action text is what someone would actually DO, so it leads;
        # the sub-objective is the context it sits under.
        "title": action["action_text"],
        "objective": action["sub_objective_title"],
        "source": strategy_source(action, top),
    }


# --- candidate actions (NEW — not in the real api; this product direction's own logic) ----

COVARIATE_ACTIONS = [
    {
        "id": "multilingual-outreach",
        "title": "Multilingual, community-based screening outreach",
        "description": "Targeted invitations and reminders in the Region's most common non-Finnish/Swedish languages, run with community organisations rather than a generic translation.",
        "condition": lambda p: p["covariates"]["immigrant_background_pct"] > MEDIAN["immigrant_background_pct"]
        and any(g["gap"]["severity"] != "ok" and INDICATORS[g["gap"]["indicator_code"]]["cancer_type"] for g in p["gaps"]),
        "why": "Foreign background share here ({value:.1f}%) is above the national median ({median:.1f}%), and this is the one covariate that predicts lower screening attendance at both the Region and individual level (see methodology) — a double-confirmed, defensible targeting signal.",
        "workflow": {"type": "patient_message", "profile": "invitees whose recorded native language is not Finnish or Swedish"},
    },
    {
        "id": "mobile-screening",
        "title": "Mobile screening unit / local transport partnership",
        "description": "Bring the screening van to outlying municipalities, or subsidise a shared-ride service to the nearest screening site, instead of asking residents to travel alone.",
        "condition": lambda p: p["covariates"]["kela_travel_eur_per_capita"] > MEDIAN["kela_travel_eur_per_capita"]
        and any(g["gap"]["severity"] != "ok" and INDICATORS[g["gap"]["indicator_code"]]["cancer_type"] for g in p["gaps"]),
        "why": "Kela medical-travel reimbursement here is EUR {value:.1f}/capita, above the EUR {median:.1f}/capita national median — this Region's residents already claim well above the typical travel cost, consistent with real distance being a barrier, not just a preference.",
        "workflow": {"type": "stakeholder_message", "target": "{region} wellbeing services county — transport & logistics"},
    },
    {
        "id": "travel-reimbursement-awareness",
        "title": "Travel-reimbursement awareness campaign",
        "description": "Make sure patients already know Kela covers most of the trip cost before they decide not to go — a lot of the real barrier may be not knowing the reimbursement exists.",
        "condition": lambda p: p["covariates"]["kela_travel_eur_per_capita"] > MEDIAN["kela_travel_eur_per_capita"],
        "why": "This Region's travel-reimbursement spend per capita is already above median — the programme is used, but awareness of it (rather than just its existence) is worth checking before assuming distance alone explains any remaining gap.",
        "workflow": {"type": "patient_message", "profile": "all invitees in this Region"},
    },
    {
        "id": "low-bandwidth-channel",
        "title": "SMS/voice-first reminder channel",
        "description": "Default to SMS and a voice-narrated message rather than a My Kanta app push, for Regions where fast home broadband is less available.",
        "condition": lambda p: p["covariates"]["broadband_gigabit_pct"] < MEDIAN["broadband_gigabit_pct"],
        "why": "Gigabit broadband reaches only {value:.1f}% of households here, below the {median:.1f}% national median — an app-first reminder is more likely to be missed than in a better-connected Region.",
        "workflow": {"type": "patient_message", "profile": "all invitees in this Region (SMS/voice channel)"},
    },
    {
        "id": "capacity-review",
        "title": "Primary-care / specialist capacity review",
        "description": "A direct staffing and scheduling review with the Region's own specialised-care management — not an outreach fix, because the data here doesn't point to a demand-side cause.",
        "condition": lambda p: any(
            g["gap"]["severity"] != "ok" and not INDICATORS[g["gap"]["indicator_code"]]["cancer_type"] for g in p["gaps"]
        ),
        "why": "The long-wait/referral figures here are outside the ok range, and none of the covariates we track explain which Regions have this problem (all |r| <= 0.27 against this measure) — that pattern points at capacity, not access, so an outreach campaign is the wrong tool.",
        "workflow": {"type": "stakeholder_message", "target": "{region} wellbeing services county board"},
    },
]


def candidate_actions(profile: dict) -> list[dict]:
    # Several screening indicators often share the same top-ranked strategy
    # action (e.g. 2.4.1 is rank 1 for breast, cervical AND colorectal) --
    # merge by action id instead of repeating the identical node per indicator.
    by_action: dict[str, dict] = {}
    for g in profile["gaps"]:
        if g["gap"]["severity"] == "ok":
            continue
        action = matched_action(g["gap"]["indicator_code"])
        if not action:
            continue
        entry = by_action.setdefault(action["id"], {"action": action, "indicators": []})
        cancer_type = INDICATORS[g["gap"]["indicator_code"]]["cancer_type"]
        entry["indicators"].append(cancer_type or g["indicator"]["name"].lower())

    out = []
    for action_id, entry in by_action.items():
        action, names = entry["action"], entry["indicators"]
        if len(names) > 1:
            label = f"{', '.join(names[:-1])} and {names[-1]} screening Gaps"
        else:
            label = f"{names[0]} Gap"
        out.append({
            "id": f"strategy-{action_id}",
            "kind": "strategy",
            "recommended": True,
            "title": action["title"],
            "description": f"Sub-objective {action_id}: {action['objective']}",
            "why": f"Matched to the {label}. {action['source']}",
            "workflow": {"type": "stakeholder_message", "target": f"{profile['region']['name']} wellbeing services county — screening programme lead"},
        })
    for tpl in COVARIATE_ACTIONS:
        if tpl["condition"](profile):
            out.append({
                "id": tpl["id"],
                "kind": "covariate",
                "recommended": True,
                "title": tpl["title"],
                "description": tpl["description"],
                "why": tpl["why"],
                "workflow": {k: (v.format(region=profile["region"]["name"]) if isinstance(v, str) else v) for k, v in tpl["workflow"].items()},
            })
    return out


def action_library(code: str) -> list[dict]:
    """Every curated National Cancer Strategy action, in the same shape as a
    candidate -- so a decision-maker can search the whole strategy and add an
    action the engine didn't match, not just the recommended ones."""
    region_name = NAME[code]
    out = []
    for action_id, action in sorted(STRATEGY_ACTIONS.items()):
        out.append({
            "id": f"strategy-{action_id}",
            "kind": "strategy",
            "recommended": False,
            "title": action["action_text"],
            "description": f"Sub-objective {action_id}: {action['sub_objective_title']}",
            "why": (
                "Added from the National Cancer Strategy by hand — this one was not matched to a Gap "
                f"in this Region by the engine. {strategy_source(action)}"
            ),
            "workflow": {"type": "stakeholder_message", "target": f"{region_name} wellbeing services county — screening programme lead"},
        })
    return out


def _fill_why(action: dict, profile: dict) -> dict:
    """Fill {value}/{median} placeholders in covariate actions' `why` text."""
    why = action["why"]
    if "{value" in why:
        key = {
            "multilingual-outreach": "immigrant_background_pct",
            "mobile-screening": "kela_travel_eur_per_capita",
            "travel-reimbursement-awareness": "kela_travel_eur_per_capita",
            "low-bandwidth-channel": "broadband_gigabit_pct",
        }.get(action["id"])
        if key:
            why = why.format(value=profile["covariates"][key], median=MEDIAN[key])
    action = dict(action)
    action["why"] = why
    return action


def synthesize(profile: dict) -> list[str]:
    """A deterministic, multi-sentence synthesis — same 'exact by
    construction' spirit as common/template.py's single-Gap sentences,
    extended across every Gap and covariate this Region has. Not an LLM
    call (there's nothing here to hallucinate from); a rule-based reading
    of the real findings in research/covariate_correlation_analysis.md and
    cancer_registry_screening_reports.md."""
    gaps = profile["gaps"]
    cov = profile["covariates"]
    cov_meta = profile["covariate_meta"]
    name = profile["region"]["name"]
    out: list[str] = []

    screening = [g for g in gaps if INDICATORS[g["gap"]["indicator_code"]]["cancer_type"]]
    capacity = [g for g in gaps if not INDICATORS[g["gap"]["indicator_code"]]["cancer_type"]]
    bad_screening = [g for g in screening if g["gap"]["severity"] != "ok"]
    bad_capacity = [g for g in capacity if g["gap"]["severity"] != "ok"]

    if not bad_screening and not bad_capacity:
        out.append(f"{name} is at or ahead of target on every tracked indicator this year — no Gap needs action.")
    else:
        if bad_screening:
            types = [INDICATORS[g["gap"]["indicator_code"]]["cancer_type"] for g in bad_screening]
            out.append(
                f"Screening attendance is below target for {', '.join(types)} cancer"
                f"{'s' if len(types) > 1 else ''}."
            )
            immigrant_high = cov["immigrant_background_pct"] > cov_meta["immigrant_background_pct"]["median"]
            if immigrant_high:
                out.append(
                    f"This Region's foreign-background share ({cov['immigrant_background_pct']:.1f}%) is above "
                    f"the national median ({cov_meta['immigrant_background_pct']['median']:.1f}%) — the one "
                    f"covariate that predicts lower attendance at both the Region and individual level, "
                    f"confirmed two independent ways (see methodology)."
                )
            else:
                out.append(
                    "This Region's foreign-background share is at or below the national median, so that "
                    "covariate doesn't explain the gap here — worth checking the local screening programme's "
                    "own delivery rather than assuming it's an outreach problem."
                )
        if bad_capacity:
            out.append(
                "Specialised-care access (long waits and/or referral processing) is also outside the ok range, "
                "and none of the structural factors this project checked (migration, income, travel distance, "
                "broadband) explain which Regions have this problem — that null result points at a capacity "
                "constraint on the supply side, not a demand-side access problem, so outreach alone won't fix it."
            )

    travel_high = cov["kela_travel_eur_per_capita"] > cov_meta["kela_travel_eur_per_capita"]["median"]
    if travel_high:
        out.append(
            f"Kela medical-travel reimbursement here runs EUR{cov['kela_travel_eur_per_capita']:.1f}/capita, "
            f"above the EUR{cov_meta['kela_travel_eur_per_capita']['median']:.1f} national median — consistent "
            f"with real distance to care, not just a preference not to go."
        )

    if profile["missing_data_notes"]:
        out.append(" ".join(profile["missing_data_notes"]))

    return out


def region_profile(code: str) -> dict:
    gaps = [score_indicator(ind_id, code) for ind_id in GAP_INDICATOR_ORDER]
    gaps = [g for g in gaps if g is not None]
    missing = [ind_id for ind_id in GAP_INDICATOR_ORDER if INDICATORS[ind_id]["values"].get(code) is None]
    notes = []
    if missing:
        names = ", ".join(INDICATORS[m]["name"] for m in missing)
        notes.append(f"No {YEAR} data for: {names}.")

    covariates = {k: v["values"][code] for k, v in COVARIATES.items()}
    profile = {
        "region": {"code": code, "name": NAME[code], "kind": KIND[code]},
        "year": YEAR,
        "gaps": gaps,
        "covariates": covariates,
        "covariate_meta": {k: {"name": v["name"], "unit": v["unit"], "median": MEDIAN[k]} for k, v in COVARIATES.items()},
        "missing_data_notes": notes,
    }
    acting = sum(1 for g in gaps if g["gap"]["severity"] == "act")
    watching = sum(1 for g in gaps if g["gap"]["severity"] == "watch")
    profile["summary"] = {"indicators_tracked": len(gaps), "indicators_act": acting, "indicators_watch": watching}
    profile["synthesis"] = synthesize(profile)
    profile["candidate_actions"] = [_fill_why(a, profile) for a in candidate_actions(profile)]
    return profile


def overview() -> dict:
    """One row per Region — the overview map's aggregate 'how many gaps need attention',
    not a single hidden score (ADR 0001: this product measures Gaps, not one ranking)."""
    rows = []
    for code, name, kind, _ in REGIONS:
        gaps = [score_indicator(ind_id, code) for ind_id in GAP_INDICATOR_ORDER]
        gaps = [g for g in gaps if g is not None]
        acting = sum(1 for g in gaps if g["gap"]["severity"] == "act")
        watching = sum(1 for g in gaps if g["gap"]["severity"] == "watch")
        rows.append({
            "region": {"code": code, "name": name, "kind": kind},
            "indicators_tracked": len(gaps),
            "indicators_act": acting,
            "indicators_watch": watching,
        })
    return {"year": YEAR, "rows": rows}


class Handler(BaseHTTPRequestHandler):
    def _send(self, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path, _, query = self.path.partition("?")
        parts = path.strip("/").split("/")
        if path == "/overview":
            self._send(overview())
        elif len(parts) == 3 and parts[0] == "regions" and parts[2] == "profile":
            code = parts[1]
            if code not in NAME:
                self.send_response(404); self.end_headers(); return
            self._send(region_profile(code))
        elif len(parts) == 3 and parts[0] == "regions" and parts[2] == "action-library":
            code = parts[1]
            if code not in NAME:
                self.send_response(404); self.end_headers(); return
            self._send({"region_code": code, "actions": action_library(code)})
        elif path == "/regions":
            self._send({"regions": [{"code": c, "name": n, "kind": KIND[c]} for c, n, _, _ in REGIONS]})
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print("indicators loaded:", {k: len(v["values"]) for k, v in INDICATORS.items()})
    print("parent areas:", len(PARENT_AREA), "strategy indicators linked:", len(STRATEGY_LINKS))
    HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
