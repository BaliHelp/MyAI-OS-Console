-- ════════════════════════════════════════════════════════════════════════
-- Migration: Authoritative field/tier routing + unique constraint
-- Jalankan di Supabase SQL Editor (SETELAH semua migrasi 20260717/20260718).
--
-- WHY: gw_field_pool_assignments had no unique constraint, so job_specs.sql,
-- ocr_fixes.sql and claude_tier3_and_visa_field.sql each DELETE+INSERT the same
-- OCR fields with CONFLICTING tiers, applied in lexicographic filename order.
-- The effective live routing was therefore not reproducible from the files.
-- This migration is the single source of truth: it deduplicates, locks the table
-- with a UNIQUE(field_key, provider) constraint, and re-asserts the full routing
-- table idempotently. Re-running it yields the exact same rows every time.
--
-- Routing policy encoded here:
--   * deepseek is intentionally absent — it was disabled ecosystem-wide in
--     ocr_fixes.sql and cannot accept image input (no vision support).
--   * OCR / vision fields are pinned to vision-capable providers only
--     (gemini → gpt → claude), matching the runtime vision guard in
--     app/api/v1/chat/completions/route.ts.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Deduplicate existing (field_key, provider) pairs ──────────────────
-- Keep the lowest pool_tier for each pair so the constraint below can be added.
DELETE FROM public.gw_field_pool_assignments a
USING public.gw_field_pool_assignments b
WHERE a.field_key = b.field_key
  AND a.provider  = b.provider
  AND a.pool_tier > b.pool_tier;

-- Remove any exact duplicates left (same field_key, provider AND tier).
DELETE FROM public.gw_field_pool_assignments a
USING public.gw_field_pool_assignments b
WHERE a.field_key = b.field_key
  AND a.provider  = b.provider
  AND a.pool_tier = b.pool_tier
  AND a.ctid > b.ctid;

-- ── 2. Add the UNIQUE constraint (idempotent) ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gw_field_pool_assignments_field_provider_key'
  ) THEN
    ALTER TABLE public.gw_field_pool_assignments
      ADD CONSTRAINT gw_field_pool_assignments_field_provider_key
      UNIQUE (field_key, provider);
  END IF;
END $$;

-- ── 3. Register new fields in gw_ai_fields ───────────────────────────────
INSERT INTO public.gw_ai_fields (field_key, display_name, description, auto_mode) VALUES
  ('chatbot_generic', 'Chatbot Persona-Free (Multi-Tenant)',
   'Chat field yang menghormati system prompt milik pemanggil — tanpa persona MyVISA AI. Untuk aplikasi lain yang butuh suaranya sendiri.', true),
  ('structured_extraction', 'Ekstraksi Terstruktur (Klasifikasi/JSON)',
   'Ekstraksi/klasifikasi teks menjadi JSON terstruktur (mis. klasifikasi email). Tanpa injeksi persona.', true)
ON CONFLICT (field_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  auto_mode    = EXCLUDED.auto_mode;

-- ── 4. Re-assert the full routing table (authoritative) ──────────────────
-- DELETE the managed fields, then INSERT the canonical set. Idempotent.
DELETE FROM public.gw_field_pool_assignments
WHERE field_key IN (
  'ocr_id_document', 'ocr_travel_document', 'ocr_financial_document',
  'ocr_general_document', 'ocr_photo_validation', 'visa_registration_extraction',
  'content_generation', 'coding_assistant', 'reasoning_general', 'orchestrator',
  'chatbot', 'chatbot_general', 'chatbot_checkout', 'chatbot_generic',
  'structured_extraction'
);

INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier) VALUES
  -- Vision / OCR fields → vision-capable providers only (gemini → gpt → claude)
  ('ocr_id_document',              'gemini', 1), ('ocr_id_document',              'gpt', 2), ('ocr_id_document',              'claude', 3),
  ('ocr_travel_document',          'gemini', 1), ('ocr_travel_document',          'gpt', 2), ('ocr_travel_document',          'claude', 3),
  ('ocr_financial_document',       'gemini', 1), ('ocr_financial_document',       'gpt', 2), ('ocr_financial_document',       'claude', 3),
  ('ocr_general_document',         'gemini', 1), ('ocr_general_document',         'gpt', 2), ('ocr_general_document',         'claude', 3),
  ('ocr_photo_validation',         'gemini', 1), ('ocr_photo_validation',         'gpt', 2), ('ocr_photo_validation',         'claude', 3),
  ('visa_registration_extraction', 'gemini', 1), ('visa_registration_extraction', 'gpt', 2), ('visa_registration_extraction', 'claude', 3),

  -- Text fields
  ('content_generation',    'gpt',    1), ('content_generation',    'claude', 2),
  ('coding_assistant',      'claude', 1), ('coding_assistant',      'gpt',    2),
  ('reasoning_general',     'claude', 1), ('reasoning_general',     'gpt',    2),
  ('orchestrator',          'claude', 1), ('orchestrator',          'gpt',    2),
  ('structured_extraction', 'gpt',    1), ('structured_extraction', 'claude', 2), ('structured_extraction', 'gemini', 3),

  -- Chat fields (deepseek removed — disabled ecosystem-wide)
  ('chatbot',          'gpt', 1), ('chatbot',          'claude', 2),
  ('chatbot_general',  'gpt', 1), ('chatbot_general',  'claude', 2),
  ('chatbot_checkout', 'gpt', 1), ('chatbot_checkout', 'claude', 2),
  ('chatbot_generic',  'gpt', 1), ('chatbot_generic',  'claude', 2);

-- ── 5. Field specs for the new fields ────────────────────────────────────
INSERT INTO public.gw_field_specs (field_key, system_prompt, output_schema) VALUES
  (
    'chatbot_generic',
    'Kamu adalah asisten AI serbaguna untuk aplikasi pemanggil. Jika bagian "--- CALLER INSTRUCTIONS ---" diberikan di atas, ikuti persona, gaya, dan aturannya sebagai sumber utama identitasmu. Jangan pernah menggunakan persona "MyVISA AI" atau "Iva" di field ini. Jawab dengan jelas dan profesional.',
    NULL
  ),
  (
    'structured_extraction',
    'Kamu adalah mesin ekstraksi/klasifikasi terstruktur. Respons HANYA berupa objek JSON valid — tanpa teks lain, tanpa code fence. Gunakan PERSIS nama key yang diminta pemanggil (di CALLER INSTRUCTIONS atau prompt); jangan mengganti, menerjemahkan, atau menambah key. Kembalikan null untuk nilai yang tidak ditemukan.',
    NULL
  )
ON CONFLICT (field_key) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  output_schema = EXCLUDED.output_schema,
  updated_at    = now();
