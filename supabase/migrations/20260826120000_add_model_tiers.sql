-- Add Low/Medium/Top tier variants for every provider (Gemini, DeepSeek, Qwen, Kimi, Claude,
-- GPT, Grok) — additive only, follows the exact same pattern as
-- 20260816090000_add_kimi_k3_top_tier.sql: each new identity reuses its parent provider's
-- already-stored encrypted key (vendors don't scope a key to one model), just with a different
-- model_name. Nothing here touches an existing gw_provider_keys row, and nothing is inserted
-- into gw_field_pool_assignments — these tiers are NOT part of automatic complexity-tier
-- routing, only reachable via an explicit `model`/`provider` override in the request body (see
-- the escape hatch in app/api/v1/chat/completions/route.ts). Zero risk to routing already relied
-- on by existing client apps.

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'gemini_medium', 'Gemini Medium (2.5 Flash)', key_encrypted, base_url, 'active', 0, 'gemini-2.5-flash'
FROM public.gw_provider_keys WHERE provider = 'gemini' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'gemini_top', 'Gemini Top (3.1 Pro Preview)', key_encrypted, base_url, 'active', 0, 'gemini-3.1-pro-preview'
FROM public.gw_provider_keys WHERE provider = 'gemini' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'deepseek_v4_flash', 'DeepSeek Medium (V4 Flash)', key_encrypted, base_url, 'active', 0, 'deepseek-v4-flash'
FROM public.gw_provider_keys WHERE provider = 'deepseek' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'deepseek_v4_pro', 'DeepSeek Top (V4 Pro)', key_encrypted, base_url, 'active', 0, 'deepseek-v4-pro'
FROM public.gw_provider_keys WHERE provider = 'deepseek' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'qwen_low', 'Qwen Low (3.5 Flash)', key_encrypted, base_url, 'active', 0, 'qwen3.5-flash'
FROM public.gw_provider_keys WHERE provider = 'qwen' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'qwen_medium', 'Qwen Medium (3.6 Flash)', key_encrypted, base_url, 'active', 0, 'qwen3.6-flash'
FROM public.gw_provider_keys WHERE provider = 'qwen' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'kimi_k2_5', 'Moonshot Kimi Low (K2.5)', key_encrypted, base_url, 'active', 0, 'kimi-k2.5'
FROM public.gw_provider_keys WHERE provider = 'kimi' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'claude_low', 'Claude Low (Haiku 4.5)', key_encrypted, base_url, 'active', 0, 'claude-haiku-4-5-20251001'
FROM public.gw_provider_keys WHERE provider = 'claude' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'claude_top', 'Claude Top (Opus 5)', key_encrypted, base_url, 'active', 0, 'claude-opus-5'
FROM public.gw_provider_keys WHERE provider = 'claude' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'gpt_medium', 'GPT Medium (4.1)', key_encrypted, base_url, 'active', 0, 'gpt-4.1'
FROM public.gw_provider_keys WHERE provider = 'gpt' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'gpt_top', 'GPT Top (5.1)', key_encrypted, base_url, 'active', 0, 'gpt-5.1'
FROM public.gw_provider_keys WHERE provider = 'gpt' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'grok_low', 'Grok Low (Build 0.1)', key_encrypted, base_url, 'active', 0, 'grok-build-0.1'
FROM public.gw_provider_keys WHERE provider = 'grok' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'grok_medium', 'Grok Medium (4.3)', key_encrypted, base_url, 'active', 0, 'grok-4.3'
FROM public.gw_provider_keys WHERE provider = 'grok' AND status = 'active' LIMIT 1;

-- Widen provider_scope on every active gateway API key that already trusts a tier's parent
-- provider, so existing client apps can start using the new tiers via an explicit `model`/
-- `provider` override without an admin having to re-grant each one manually. Does NOT touch
-- auto-routing — grant alone doesn't put a tier into any field's tier chain.
DO $$
DECLARE
  pair record;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('gemini', 'gemini_medium'), ('gemini', 'gemini_top'),
      ('deepseek', 'deepseek_v4_flash'), ('deepseek', 'deepseek_v4_pro'),
      ('qwen', 'qwen_low'), ('qwen', 'qwen_medium'),
      ('kimi', 'kimi_k2_5'),
      ('claude', 'claude_low'), ('claude', 'claude_top'),
      ('gpt', 'gpt_medium'), ('gpt', 'gpt_top'),
      ('grok', 'grok_low'), ('grok', 'grok_medium')
    ) AS t(parent, child)
  LOOP
    UPDATE public.gw_api_keys
    SET provider_scope = provider_scope || ARRAY[pair.child]::text[]
    WHERE status = 'active'
      AND pair.parent = ANY(provider_scope)
      AND NOT (pair.child = ANY(provider_scope));
  END LOOP;
END $$;
