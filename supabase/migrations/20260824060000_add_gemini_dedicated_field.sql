-- Dedicated field that always routes straight to Google Gemini (multi-key pool), regardless
-- of prompt complexity (light/reasoning/top all resolve to the same single tier 1 = gemini, no
-- fallback chain) — for callers that explicitly want Gemini, not the field-agnostic auto-routing
-- chains. Mirrors the kimi dedicated field (20260823190000_add_kimi_dedicated_field.sql).
--
-- Model: adapter default is gemini-3.5-flash-lite (fallback gemini-flash-lite-latest). A caller
-- that wants a specific (advanced) Gemini model may pass body.model_name — the gemini adapter
-- tries it first, then falls back to gemini-flash-lite-latest if the key cannot access it.
-- Idempotent — safe to re-run.

INSERT INTO public.gw_ai_fields (field_key, display_name, description, auto_mode)
VALUES ('gemini', 'Gemini (Direct)', 'Routes directly to Google Gemini for every prompt-length class, no fallback tier.', true)
ON CONFLICT (field_key) DO NOTHING;

INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier, complexity) VALUES
  ('gemini', 'gemini', 1, 'light'),
  ('gemini', 'gemini', 1, 'reasoning'),
  ('gemini', 'gemini', 1, 'top')
ON CONFLICT (field_key, provider, complexity) DO NOTHING;
