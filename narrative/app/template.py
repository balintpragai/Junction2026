"""Template sentences: a Gap's numbers in fixed wording, exact by construction.

The only kind of Narrative shown in Finnish. Finnish wording avoids inflecting
the Region name ("Helsinki: ...") so any Region name drops in unchanged.
Finnish copy is pending native-speaker review (#21).
"""

from common.models import NarrativeRequest

from .numbers import format_number

# Changing any string here changes PROMPT_VERSION (see prompt.py).
EN = {
    "target": "{region} is {abs_dev} {dev_unit} {direction} the {reference}{unit} target for {indicator} in {year}, ranking {rank} of {n}.",
    "peer_median": "{region} is {abs_dev} {dev_unit} {direction} the median of {n} Regions ({reference}{unit}) for {indicator} in {year}, ranking {rank} of {n}.",
    "at_target": "{region} is at the {reference}{unit} target for {indicator} in {year}, ranking {rank} of {n}.",
    "at_peer_median": "{region} is at the median of {n} Regions ({reference}{unit}) for {indicator} in {year}, ranking {rank} of {n}.",
    "above": "above",
    "below": "below",
    "pp": "pp",
}
FI = {
    "target": "{region}: {indicator} {value}{unit} vuonna {year}, {abs_dev} {dev_unit} {direction} tavoitteen ({reference}{unit}). Sijoitus {rank}/{n}.",
    "peer_median": "{region}: {indicator} {value}{unit} vuonna {year}, {abs_dev} {dev_unit} {direction} alueiden mediaanin ({reference}{unit}). Sijoitus {rank}/{n}.",
    "at_target": "{region}: {indicator} {value}{unit} vuonna {year}, tavoitteen ({reference}{unit}) tasolla. Sijoitus {rank}/{n}.",
    "at_peer_median": "{region}: {indicator} {value}{unit} vuonna {year}, alueiden mediaanin ({reference}{unit}) tasolla. Sijoitus {rank}/{n}.",
    "above": "yli",
    "below": "alle",
    "pp": "prosenttiyksikköä",
}
TEMPLATES = {"en": EN, "fi": FI}


def _lower_first(name: str) -> str:
    """'Breast cancer screening' -> 'breast cancer screening'; leaves 'HPV ...' alone."""
    return name[0].lower() + name[1:] if len(name) > 1 and name[1].islower() else name


def template_sentence(req: NarrativeRequest) -> str:
    lang = req.language
    words = TEMPLATES[lang]
    gap = req.gap
    is_percent = req.unit.strip() == "%"
    if lang == "fi":
        unit = " %" if is_percent else f" {req.unit}"
        indicator = _lower_first(req.indicator_name_fi or req.indicator_name)
    else:
        unit = "%" if is_percent else f" {req.unit}"
        indicator = _lower_first(req.indicator_name)

    key = gap.reference_kind if gap.direction != "at" else f"at_{gap.reference_kind}"
    return words[key].format(
        region=req.region_name,
        indicator=indicator,
        year=gap.year,
        value=format_number(gap.value, lang),
        reference=format_number(gap.reference_value, lang),
        abs_dev=format_number(abs(gap.deviation), lang),
        dev_unit=words["pp"] if is_percent else req.unit,
        unit=unit,
        direction=words.get(gap.direction, ""),
        rank=gap.rank,
        n=gap.n_regions,
    )
