-- Reach Loop schema, part 1: the seven tables from BUILD.md Workstream 1.
--
-- Applied once, in file-name order, by `seed` (see seed/seed/schema.py), which
-- records each file in `schema_migrations`. Never edit a file that has shipped:
-- add the next numbered file instead.
--
-- Vocabulary follows GLOSSARY.md: Region, Gap, Target, Severity, Narrative.

-- The 23 Regions: 21 wellbeing services counties, the City of Helsinki, Åland.
CREATE TABLE dim_region (
    region_id         integer PRIMARY KEY,           -- Sotkanet region id, e.g. 960
    code              text    NOT NULL UNIQUE,       -- Sotkanet region code, e.g. '90'
    name_en           text    NOT NULL,
    name_fi           text    NOT NULL,
    name_sv           text    NOT NULL,
    kind              text    NOT NULL
        CHECK (kind IN ('wellbeing_services_county', 'city_of_helsinki', 'aland')),
    -- Peer group for Gap comparisons, curated by hand in data/curated/region_parent_area.csv.
    parent_area       text,
    parent_area_basis text,
    parent_area_note  text
);

-- Everything the engine can score, plus covariates (pathway_stage = 'covariate').
-- A new indicator is a new row in data/curated/indicators.csv, not new code.
CREATE TABLE dim_indicator (
    indicator_id     text PRIMARY KEY,               -- Sotkanet id ('3621') or a readable id for non-Sotkanet covariates
    name             text NOT NULL,
    name_fi          text,
    source           text NOT NULL,
    unit             text NOT NULL,
    pathway_stage    text NOT NULL
        CHECK (pathway_stage IN ('detection', 'referral', 'treatment_initiation', 'outcome', 'covariate')),
    cancer_type      text,                           -- NULL = not cancer-specific; 'all' = all cancer sites
    has_named_target boolean NOT NULL,
    target_value     double precision,               -- the National Cancer Strategy Target, if any
    higher_is_better boolean,                        -- NULL only for covariates, which are never scored
    CHECK (has_named_target = (target_value IS NOT NULL)),
    CHECK (pathway_stage = 'covariate' OR higher_is_better IS NOT NULL)
);

-- Every value in data/processed/, one row per Region, indicator and year.
-- A missing year is either absent or stored with value NULL and a note saying
-- why; it is never interpolated and never zero.
CREATE TABLE fact_indicator_value (
    region_id          integer NOT NULL REFERENCES dim_region (region_id),
    indicator_id       text    NOT NULL REFERENCES dim_indicator (indicator_id),
    year               integer NOT NULL,
    value              double precision,
    -- List of {"code": ..., "message": ...}, the shape of common.models.DataQualityNote.
    data_quality_notes jsonb   NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (region_id, indicator_id, year),
    CHECK (jsonb_typeof(data_quality_notes) = 'array'),
    CHECK (value IS NOT NULL OR jsonb_array_length(data_quality_notes) > 0)
);

CREATE INDEX fact_indicator_value_indicator_year ON fact_indicator_value (indicator_id, year);

-- National Cancer Strategy "Proposals for action", curated in data/curated/strategy_action.csv.
-- Columns mirror the CSV; all text, because the file is edited by hand.
CREATE TABLE dim_strategy_action (
    action_id           text PRIMARY KEY,
    sub_objective       text,
    goal                text,
    sub_objective_title text,
    action_text         text,
    action_text_fi      text,
    text_status         text,
    translation_note    text,
    fi_verified         text,
    strategy_page       text,
    roadmap_page        text,
    responsible         text,
    budget_eur          text,
    budget_note         text,
    milestone_2026_2028 text,
    milestone_2029_2031 text
);

-- Which action(s) address which indicator(s), from data/curated/strategy_action_indicator.csv.
CREATE TABLE strategy_action_indicator (
    indicator_id text    NOT NULL REFERENCES dim_indicator (indicator_id),
    action_id    text    NOT NULL REFERENCES dim_strategy_action (action_id),
    rank         integer,                            -- 1 = the action shown first for this indicator
    link_basis   text,
    source_ref   text,
    source_quote text,
    note         text,
    PRIMARY KEY (indicator_id, action_id)
);

-- Output of engine/app/scoring.py: one Gap per Region, indicator and year.
-- Columns follow common.models.Gap. Written by the rescore job (#13).
CREATE TABLE fact_gap_score (
    region_id          integer NOT NULL REFERENCES dim_region (region_id),
    indicator_id       text    NOT NULL REFERENCES dim_indicator (indicator_id),
    year               integer NOT NULL,
    value              double precision NOT NULL,
    reference_kind     text    NOT NULL CHECK (reference_kind IN ('target', 'peer_median')),
    reference_value    double precision NOT NULL,
    deviation          double precision NOT NULL,
    direction          text    NOT NULL CHECK (direction IN ('above', 'below', 'at')),
    severity           text    NOT NULL CHECK (severity IN ('ok', 'watch', 'act')),
    rank               integer NOT NULL CHECK (rank >= 1),
    n_regions          integer NOT NULL CHECK (n_regions >= 1),
    peer_values        jsonb   NOT NULL DEFAULT '[]'::jsonb,   -- list of {"region_code", "value"}
    trend_5y           double precision,
    data_quality_notes jsonb   NOT NULL DEFAULT '[]'::jsonb,   -- list of {"code", "message"}
    engine_version     text    NOT NULL,
    scored_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (region_id, indicator_id, year)
);

-- Narratives, so the LLM is called once per Gap and prompt version.
-- `source` uses the contract's terms: 'llm' or 'template' (a Template sentence).
CREATE TABLE narrative_cache (
    region_id       integer NOT NULL REFERENCES dim_region (region_id),
    indicator_id    text    NOT NULL REFERENCES dim_indicator (indicator_id),
    year            integer NOT NULL,
    language        text    NOT NULL CHECK (language IN ('en', 'fi')),
    model           text    NOT NULL,                -- '' for a Template sentence
    prompt_version  text    NOT NULL,
    text            text    NOT NULL CHECK (length(text) > 0),
    source          text    NOT NULL CHECK (source IN ('llm', 'template')),
    numbers_checked boolean NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (region_id, indicator_id, year, language, model, prompt_version)
);
