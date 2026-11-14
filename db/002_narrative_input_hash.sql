-- Reach Loop schema, part 2: the Narrative cache remembers what it was made from (#17).
--
-- `input_hash` is a SHA-256 of the Narrative request (the Gap, the Region and
-- indicator names, the matched action text, the data-quality notes) plus the
-- configured LLM model. The engine regenerates a Narrative only when this hash
-- or the prompt_version changes, so a rescore with unchanged inputs makes no
-- LLM calls. Existing rows (none before #17) get '' and are regenerated.

ALTER TABLE narrative_cache ADD COLUMN input_hash text NOT NULL DEFAULT '';

CREATE INDEX narrative_cache_lookup ON narrative_cache (region_id, indicator_id, year, language);
