-- Complexity-based reasoning tiering — schema.
--
-- gw_field_pool_assignments currently holds one flat failover chain per field,
-- tried in the same order for every request regardless of question length/depth.
-- This adds a 'complexity' bucket dimension (light/reasoning/top) so a field can
-- define up to 3 independent fallback chains, selected server-side per request
-- from the prompt's length (see lib/classify-complexity.ts).
--
-- Existing rows backfill to 'light' via the column DEFAULT — zero behavior change
-- for every field that doesn't get dedicated reasoning/top rows (every field
-- except bogani_ai, as of the companion seed migration).

ALTER TABLE public.gw_field_pool_assignments
  ADD COLUMN IF NOT EXISTS complexity text NOT NULL DEFAULT 'light';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gw_field_pool_assignments_complexity_check'
  ) THEN
    ALTER TABLE public.gw_field_pool_assignments
      ADD CONSTRAINT gw_field_pool_assignments_complexity_check
      CHECK (complexity IN ('light', 'reasoning', 'top'));
  END IF;
END $$;

-- Widen UNIQUE(field_key, provider) to UNIQUE(field_key, provider, complexity) so a
-- provider can appear once per bucket instead of once per field. This is a strict
-- widening — anything that was a valid unique combination before still is.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gw_field_pool_assignments_field_provider_key'
  ) THEN
    ALTER TABLE public.gw_field_pool_assignments
      DROP CONSTRAINT gw_field_pool_assignments_field_provider_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gw_field_pool_assignments_field_provider_complexity_key'
  ) THEN
    ALTER TABLE public.gw_field_pool_assignments
      ADD CONSTRAINT gw_field_pool_assignments_field_provider_complexity_key
      UNIQUE (field_key, provider, complexity);
  END IF;
END $$;
