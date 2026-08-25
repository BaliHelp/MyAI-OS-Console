-- Add gemini_flash_3_7 / gemini_flash_3_5 as additional Gemini text price/quality points beyond
-- the existing Low/Medium/Top slots — same additive pattern as
-- 20260826120000_add_model_tiers.sql: reuse the existing 'gemini' key's ciphertext, no new
-- secret needed, nothing added to gw_field_pool_assignments (reachable only via explicit
-- model/provider override, see app/api/v1/chat/completions/route.ts).

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'gemini_flash_3_7', 'Gemini 3.7 Flash', key_encrypted, base_url, 'active', 0, 'gemini-3.7-flash'
FROM public.gw_provider_keys WHERE provider = 'gemini' AND status = 'active' LIMIT 1;

INSERT INTO public.gw_provider_keys (provider, label, key_encrypted, base_url, status, priority, model_name)
SELECT 'gemini_flash_3_5', 'Gemini 3.5 Flash', key_encrypted, base_url, 'active', 0, 'gemini-3.5-flash'
FROM public.gw_provider_keys WHERE provider = 'gemini' AND status = 'active' LIMIT 1;

DO $$
DECLARE
  pair record;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('gemini', 'gemini_flash_3_7'),
      ('gemini', 'gemini_flash_3_5')
    ) AS t(parent, child)
  LOOP
    UPDATE public.gw_api_keys
    SET provider_scope = provider_scope || ARRAY[pair.child]::text[]
    WHERE status = 'active'
      AND pair.parent = ANY(provider_scope)
      AND NOT (pair.child = ANY(provider_scope));
  END LOOP;
END $$;
