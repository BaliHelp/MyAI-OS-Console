-- Dedicated field that always routes straight to Moonshot Kimi K3, regardless of prompt
-- complexity (light/reasoning/top all resolve to the same single tier 1 = kimi_k3, no fallback
-- chain) — for callers that explicitly want Kimi K3, not the field-agnostic auto-routing chains.

INSERT INTO public.gw_ai_fields (field_key, display_name, description, auto_mode)
VALUES ('kimi', 'Kimi (Direct)', 'Routes directly to Moonshot Kimi K3 for every prompt-length class, no fallback tier.', true)
ON CONFLICT (field_key) DO NOTHING;

INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier, complexity) VALUES
  ('kimi', 'kimi_k3', 1, 'light'),
  ('kimi', 'kimi_k3', 1, 'reasoning'),
  ('kimi', 'kimi_k3', 1, 'top')
ON CONFLICT (field_key, provider, complexity) DO NOTHING;
