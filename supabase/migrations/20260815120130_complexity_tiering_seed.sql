-- Complexity-based reasoning tiering — seed data for bogani_ai.
--
-- DeepSeek uses one API key across its whole model lineup, so the two new provider-key
-- rows below reuse the existing active 'deepseek' key's ciphertext rather than needing a
-- new secret — they only differ by provider name (which routing's key-candidate pooling
-- groups on) and model_name override (deepseek-reasoner instead of deepseek-chat).
--
-- 'deepseek_reasoning'/'deepseek_top' are registered as their own PROVIDER_REGISTRY
-- entries (see lib/provider-adapters/index.ts) pointing at the same deepseek adapter, so
-- these never share a candidate pool with the plain 'deepseek' light-tier key.

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, status, priority, model_name)
SELECT 'deepseek_reasoning', 'DeepSeek Reasoner — reasoning bucket', key_encrypted, 'active', 0, 'deepseek-reasoner'
FROM public.gw_provider_keys
WHERE provider = 'deepseek' AND status = 'active'
LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, status, priority, model_name)
SELECT 'deepseek_top', 'DeepSeek Reasoner — top bucket', key_encrypted, 'active', 0, 'deepseek-reasoner'
FROM public.gw_provider_keys
WHERE provider = 'deepseek' AND status = 'active'
LIMIT 1;

-- bogani_ai 'reasoning' bucket: DeepSeek's reasoning model leads, falling back to the
-- same general-purpose chain as the 'light' bucket if it fails.
INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier, complexity) VALUES
  ('bogani_ai', 'deepseek_reasoning', 1, 'reasoning'),
  ('bogani_ai', 'claude', 2, 'reasoning'),
  ('bogani_ai', 'gpt', 3, 'reasoning'),
  ('bogani_ai', 'gemini', 4, 'reasoning'),
  ('bogani_ai', 'grok', 5, 'reasoning')
ON CONFLICT (field_key, provider, complexity) DO NOTHING;

-- bogani_ai 'top' bucket: same shape, same DeepSeek reasoning model via the dedicated
-- 'top' key row (kept separate from 'reasoning' so usage/cooldown tracking and any future
-- per-bucket model swap stay independent between the two).
INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier, complexity) VALUES
  ('bogani_ai', 'deepseek_top', 1, 'top'),
  ('bogani_ai', 'claude', 2, 'top'),
  ('bogani_ai', 'gpt', 3, 'top'),
  ('bogani_ai', 'gemini', 4, 'top'),
  ('bogani_ai', 'grok', 5, 'top')
ON CONFLICT (field_key, provider, complexity) DO NOTHING;
