-- Reorder bogani_ai / chatbot_myai_home / chatbot_general to a DeepSeek-first routing chain
-- (cost-optimized: DeepSeek variants tried first in every complexity bucket, Claude/GPT/Gemini
-- kept only as fallback layers, not the default). Requested directly by the owner after
-- reviewing dashboard activity showing Claude as the de-facto default for bogani_ai.
--
-- "gpt -> grok" and "gemini -> others" are co-located at the SAME pool_tier (the routing loop
-- already tries every provider within one tier, sorted by key priority, before moving to the
-- next tier) rather than split into extra tiers. That requires gpt's and gemini's keys to
-- outrank grok's/others' within their shared tier — bumped below. No other field currently has
-- >1 provider sharing a pool_tier, so this priority bump is isolated to these 3 fields' new
-- shared tiers and doesn't change tie-breaking anywhere else.

UPDATE public.gw_provider_keys SET priority = 10 WHERE provider = 'gpt' AND status = 'active';
UPDATE public.gw_provider_keys SET priority = 10 WHERE provider = 'gemini' AND status = 'active';

-- Wipe existing assignments for the 3 fields across all 3 buckets, then rebuild in the new order.
DELETE FROM public.gw_field_pool_assignments
WHERE field_key IN ('bogani_ai', 'chatbot_myai_home', 'chatbot_general');

INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier, complexity) VALUES
  -- bogani_ai
  ('bogani_ai', 'deepseek_reasoning', 1, 'light'),
  ('bogani_ai', 'deepseek_top',       2, 'light'),
  ('bogani_ai', 'gpt',                3, 'light'),
  ('bogani_ai', 'grok',               3, 'light'),
  ('bogani_ai', 'claude',             4, 'light'),
  ('bogani_ai', 'gemini',             5, 'light'),
  ('bogani_ai', 'others',             5, 'light'),

  ('bogani_ai', 'deepseek_reasoning', 1, 'reasoning'),
  ('bogani_ai', 'deepseek_top',       2, 'reasoning'),
  ('bogani_ai', 'claude',             3, 'reasoning'),
  ('bogani_ai', 'gpt',                4, 'reasoning'),
  ('bogani_ai', 'grok',               4, 'reasoning'),
  ('bogani_ai', 'gemini',             5, 'reasoning'),
  ('bogani_ai', 'others',             5, 'reasoning'),

  ('bogani_ai', 'deepseek_top',       1, 'top'),
  ('bogani_ai', 'claude',             2, 'top'),
  ('bogani_ai', 'gpt',                3, 'top'),
  ('bogani_ai', 'grok',               3, 'top'),
  ('bogani_ai', 'gemini',             4, 'top'),
  ('bogani_ai', 'others',             4, 'top'),

  -- chatbot_myai_home (same pattern)
  ('chatbot_myai_home', 'deepseek_reasoning', 1, 'light'),
  ('chatbot_myai_home', 'deepseek_top',       2, 'light'),
  ('chatbot_myai_home', 'gpt',                3, 'light'),
  ('chatbot_myai_home', 'grok',               3, 'light'),
  ('chatbot_myai_home', 'claude',             4, 'light'),
  ('chatbot_myai_home', 'gemini',             5, 'light'),
  ('chatbot_myai_home', 'others',             5, 'light'),

  ('chatbot_myai_home', 'deepseek_reasoning', 1, 'reasoning'),
  ('chatbot_myai_home', 'deepseek_top',       2, 'reasoning'),
  ('chatbot_myai_home', 'claude',             3, 'reasoning'),
  ('chatbot_myai_home', 'gpt',                4, 'reasoning'),
  ('chatbot_myai_home', 'grok',               4, 'reasoning'),
  ('chatbot_myai_home', 'gemini',             5, 'reasoning'),
  ('chatbot_myai_home', 'others',             5, 'reasoning'),

  ('chatbot_myai_home', 'deepseek_top',       1, 'top'),
  ('chatbot_myai_home', 'claude',             2, 'top'),
  ('chatbot_myai_home', 'gpt',                3, 'top'),
  ('chatbot_myai_home', 'grok',               3, 'top'),
  ('chatbot_myai_home', 'gemini',             4, 'top'),
  ('chatbot_myai_home', 'others',             4, 'top'),

  -- chatbot_general (same pattern; gains gemini/others which it didn't have before, for consistency)
  ('chatbot_general', 'deepseek_reasoning', 1, 'light'),
  ('chatbot_general', 'deepseek_top',       2, 'light'),
  ('chatbot_general', 'gpt',                3, 'light'),
  ('chatbot_general', 'grok',               3, 'light'),
  ('chatbot_general', 'claude',             4, 'light'),
  ('chatbot_general', 'gemini',             5, 'light'),
  ('chatbot_general', 'others',             5, 'light'),

  ('chatbot_general', 'deepseek_reasoning', 1, 'reasoning'),
  ('chatbot_general', 'deepseek_top',       2, 'reasoning'),
  ('chatbot_general', 'claude',             3, 'reasoning'),
  ('chatbot_general', 'gpt',                4, 'reasoning'),
  ('chatbot_general', 'grok',               4, 'reasoning'),
  ('chatbot_general', 'gemini',             5, 'reasoning'),
  ('chatbot_general', 'others',             5, 'reasoning'),

  ('chatbot_general', 'deepseek_top',       1, 'top'),
  ('chatbot_general', 'claude',             2, 'top'),
  ('chatbot_general', 'gpt',                3, 'top'),
  ('chatbot_general', 'grok',               3, 'top'),
  ('chatbot_general', 'gemini',             4, 'top'),
  ('chatbot_general', 'others',             4, 'top');
