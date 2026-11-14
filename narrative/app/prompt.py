"""The LLM prompt, the facts it gets, and PROMPT_VERSION."""

import hashlib
import json
from typing import Any

from common.models import NarrativeRequest

from common import template
from common.template import is_percent

MAX_WORDS = 60

SYSTEM_PROMPT = f"""You write a short, plain-language summary of one Gap in Finnish cancer care for regional decision-makers.
Rules:
- Use only the figures in the facts. Never calculate, round, estimate or add any other number, including counts and ordinals written as digits.
- Write 2 or 3 sentences, at most {MAX_WORDS} words, in English.
- Say what the Gap is, how the Region ranks, and, if an action is given, what the action is.
- If a data-quality note is given, mention it briefly.
- Plain prose only: no headings, lists, markdown or quotation of the facts' field names."""

USER_TEMPLATE = "Facts (JSON):\n{facts}\n\nWrite the summary."

# Hash of everything that shapes the text, so a change to the prompt or to
# the Template sentence wording invalidates exactly the cached Narratives it affects.
PROMPT_VERSION = "v1-" + hashlib.sha256(
    json.dumps([SYSTEM_PROMPT, USER_TEMPLATE, template.TEMPLATES, MAX_WORDS], sort_keys=True).encode()
).hexdigest()[:10]


def facts(req: NarrativeRequest) -> dict[str, Any]:
    """The only figures the LLM sees, and the set its output is checked against."""
    gap = req.gap
    out: dict[str, Any] = {
        "region": req.region_name,
        "indicator": req.indicator_name,
        "year": gap.year,
        "value": gap.value,
        "unit": req.unit,
        "reference": "national target" if gap.reference_kind == "target" else "median of all Regions",
        "reference_value": gap.reference_value,
        "gap_size": abs(gap.deviation),
        "gap_unit": "percentage points" if is_percent(req.unit) else req.unit,
        "direction": gap.direction,
        "rank": gap.rank,
        "rank_meaning": "1 = best performing",
        "n_regions": gap.n_regions,
    }
    if gap.trend_5y is not None:
        out["change_over_5_years"] = gap.trend_5y
    if req.action_text:
        out["strategy_action"] = req.action_text
    if req.data_quality_note:
        out["data_quality_note"] = req.data_quality_note
    return out


def messages(req: NarrativeRequest) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": USER_TEMPLATE.format(facts=json.dumps(facts(req), ensure_ascii=False, indent=2))},
    ]
