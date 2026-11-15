"""The three covariates the Decision Map reads, by their `dim_indicator` id.

Named here rather than inline so the synthesis rules, the candidate-action
rules and the profile query all mean the same column. Every one of them
describes a Region, never a person: see `ECOLOGICAL_FALLACY_NOTE`.
"""

FOREIGN_BACKGROUND = "foreign_background_pct"
"""Share of the Region's population with a foreign background (Statistics Finland), %."""

KELA_TRAVEL_PER_CAPITA = "3213"
"""Kela medical-travel reimbursement, EUR per inhabitant (Sotkanet 3213)."""

BROADBAND_GIGABIT = "broadband_1000mbit_pct"
"""Households with gigabit broadband available (Traficom), %."""

PROFILE_COVARIATES = (FOREIGN_BACKGROUND, KELA_TRAVEL_PER_CAPITA, BROADBAND_GIGABIT)
"""The covariates a RegionProfile carries, in display order."""
