-- Add Kimi K3 as a Tier 1 'top'-bucket contender for the 3 chat fields, alongside deepseek_top
-- (co-located: both tried, sorted by key priority; either can win). Same Moonshot API key as
-- the existing 'kimi' (K2.6) row — Moonshot uses one key across its model lineup — but kept as
-- its own provider ('kimi_k3', registered in lib/provider-adapters/index.ts) so it doesn't get
-- pooled with the plain 'kimi' key at fields' final-fallback tier.

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'kimi_k3', 'Moonshot Kimi K3', key_encrypted, base_url, 'active', 0, 'kimi-k3'
FROM public.gw_provider_keys
WHERE provider = 'kimi' AND status = 'active'
LIMIT 1;

INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier, complexity) VALUES
  ('bogani_ai',          'kimi_k3', 1, 'top'),
  ('chatbot_myai_home',  'kimi_k3', 1, 'top'),
  ('chatbot_general',    'kimi_k3', 1, 'top')
ON CONFLICT (field_key, provider, complexity) DO NOTHING;

-- Widen provider_scope on every active key that already trusts 'kimi' (same account/family) so
-- the new kimi_k3 candidate isn't silently scope-filtered out of tier 1.
UPDATE public.gw_api_keys
SET provider_scope = provider_scope || ARRAY['kimi_k3']::text[]
WHERE status = 'active'
  AND 'kimi' = ANY(provider_scope)
  AND NOT ('kimi_k3' = ANY(provider_scope));
