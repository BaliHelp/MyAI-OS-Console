-- ── 1. Add ocr_fallback_to_gpt column to gw_usage_logs ──────────────────
ALTER TABLE public.gw_usage_logs ADD COLUMN IF NOT EXISTS ocr_fallback_to_gpt boolean DEFAULT false;

-- ── 2. Disable Deepseek Keys in gw_provider_keys ────────────────────────
UPDATE public.gw_provider_keys SET status = 'disabled' WHERE provider = 'deepseek';

-- ── 3. Clear existing Deepseek assignments ──────────────────────────────
DELETE FROM public.gw_field_pool_assignments WHERE provider = 'deepseek';

-- ── 4. Re-route OCR Fields (Tier 1 = gemini, Tier 2 = gpt) ──────────────
DELETE FROM public.gw_field_pool_assignments 
WHERE field_key IN ('ocr_id_document', 'ocr_travel_document', 'ocr_financial_document', 'ocr_general_document', 'ocr_photo_validation');

INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier) VALUES
  ('ocr_id_document', 'gemini', 1),
  ('ocr_id_document', 'gpt', 2),

  ('ocr_travel_document', 'gemini', 1),
  ('ocr_travel_document', 'gpt', 2),

  ('ocr_financial_document', 'gemini', 1),
  ('ocr_financial_document', 'gpt', 2),

  ('ocr_general_document', 'gemini', 1),
  ('ocr_general_document', 'gpt', 2),

  ('ocr_photo_validation', 'gemini', 1),
  ('ocr_photo_validation', 'gpt', 2);
