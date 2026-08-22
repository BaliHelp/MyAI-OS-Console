-- Eliminate the vague 'others' provider bucket and add Qwen as a first-class provider.
--
-- Context: 'others' was a shared provider string used by BOTH the Moonshot Kimi and
-- OpenRouter keys (both routed through the same generic OpenAI-compatible adapter,
-- lib/provider-adapters/custom-openai-compatible.ts, driven purely by each key's own
-- base_url/model_name). Because gw_api_keys.provider_scope and gw_field_pool_assignments
-- both key off the provider string, this made it impossible to grant a client access to
-- Kimi without also granting OpenRouter (or vice versa) — a real permission-granularity
-- bug, not just a cosmetic "Others" label in GET /api/v1/models.
--
-- This migration (already applied directly to production on 2026-08-22, documented/
-- reproduced here):
--   1. Renames the two existing 'others' gw_provider_keys rows to their own specific
--      provider identities: Moonshot Kimi -> 'kimi', OpenROUTER -> 'openrouter'.
--   2. Registers a new Qwen 3.8 Max key under provider 'qwen' (Alibaba Cloud Bailian/
--      DashScope, OpenAI-compatible endpoint) — the key value itself was inserted directly
--      via the app's encryptKey()/Supabase path, not via this file (never commit plaintext
--      or ciphertext secrets in a migration).
--   3. Expands every gw_field_pool_assignments row that referenced provider='others'
--      (bogani_ai / chatbot_myai_home / chatbot_general, all three complexity buckets)
--      into two explicit rows at the same pool_tier — one for 'kimi', one for 'openrouter'
--      — so existing failover behavior at that tier is unchanged, just explicit now.
--   4. Replaces 'others' with ['kimi','openrouter'] inside every gw_api_keys.provider_scope
--      array that contained it, preserving the exact same effective access for each client
--      app's key (Indonesian Visas, newsbali.online, MyAI Master, MyAI Developer, GINZA
--      Project) rather than silently dropping their fallback-tier access.
--
-- Qwen is registered but deliberately NOT added to any gw_field_pool_assignments row here —
-- it's available (visible in GET /api/v1/models) but not wired into any field's routing
-- until that's an explicit decision.
--
-- lib/provider-adapters/index.ts, components/AppsTab.tsx (SUPPORTED_PROVIDERS), and
-- app/api/v1/models/route.ts (PROVIDER_DISPLAY_NAME) were updated in the same commit to
-- match — see that commit for the code side of this change.

UPDATE public.gw_provider_keys
SET provider = 'kimi'
WHERE label = 'Moonshot Kimi' AND provider = 'others';

UPDATE public.gw_provider_keys
SET provider = 'openrouter'
WHERE label = 'OpenROUTER' AND provider = 'others';

INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier, complexity)
SELECT field_key, 'kimi', pool_tier, complexity
FROM public.gw_field_pool_assignments
WHERE provider = 'others';

UPDATE public.gw_field_pool_assignments
SET provider = 'openrouter'
WHERE provider = 'others';

UPDATE public.gw_api_keys
SET provider_scope = array(
  SELECT DISTINCT unnest(array_replace(provider_scope, 'others', 'kimi') || ARRAY['openrouter'])
)
WHERE 'others' = ANY(provider_scope);
