-- Retry of the OpenRouter->native-Qwen swap, reverted earlier this session when the stored
-- Qwen key tested invalid. The owner has since fixed the key in QwenCloud/DashScope and it was
-- verified live (real successful completion via provider=qwen override) before this migration.

UPDATE public.gw_field_pool_assignments
SET provider = 'qwen'
WHERE provider = 'openrouter'
  AND field_key IN ('bogani_ai', 'chatbot_myai_home', 'chatbot_general');

UPDATE public.gw_api_keys
SET provider_scope = provider_scope || ARRAY['qwen']::text[]
WHERE status = 'active'
  AND 'openrouter' = ANY(provider_scope)
  AND NOT ('qwen' = ANY(provider_scope));
