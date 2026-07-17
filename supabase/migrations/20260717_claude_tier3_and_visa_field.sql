-- ════════════════════════════════════════════════════════════════════════
-- Migration: Claude Tier 3 + visa_registration_extraction field
-- Jalankan di Supabase SQL Editor (setelah 20260717_job_specs.sql)
-- FIX: Gunakan DELETE+INSERT, bukan ON CONFLICT, karena tabel pool_assignments
--      tidak memiliki unique constraint pada (field_key, provider).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Tambah kolom ocr_fallback_to_claude di gw_usage_logs ──────────────
ALTER TABLE public.gw_usage_logs
  ADD COLUMN IF NOT EXISTS ocr_fallback_to_claude boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.gw_usage_logs.ocr_fallback_to_claude IS
  'true jika field OCR yang diminta diselesaikan oleh Claude (Tier 3 fallback)';

-- ── 2. Perbarui routing OCR: hapus tier lama, insert tier baru ────────────
-- Hapus tier 2+ yang lama (deepseek, grok, loopback gemini)
DELETE FROM public.gw_field_pool_assignments
WHERE field_key IN (
  'ocr_id_document', 'ocr_travel_document', 'ocr_financial_document',
  'ocr_general_document', 'ocr_photo_validation'
)
AND pool_tier > 1;

-- Insert rantai baru: tier 2=gpt, tier 3=claude
-- (tier 1=gemini sudah ada, tidak diubah)
INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier) VALUES
  ('ocr_id_document',          'gpt',    2),
  ('ocr_id_document',          'claude', 3),
  ('ocr_travel_document',      'gpt',    2),
  ('ocr_travel_document',      'claude', 3),
  ('ocr_financial_document',   'gpt',    2),
  ('ocr_financial_document',   'claude', 3),
  ('ocr_general_document',     'gpt',    2),
  ('ocr_general_document',     'claude', 3),
  ('ocr_photo_validation',     'gpt',    2),
  ('ocr_photo_validation',     'claude', 3);

-- ── 3. Seed field baru: visa_registration_extraction ─────────────────────

-- gw_ai_fields
DELETE FROM public.gw_ai_fields WHERE field_key = 'visa_registration_extraction';
INSERT INTO public.gw_ai_fields (field_key, display_name, description, auto_mode)
VALUES (
  'visa_registration_extraction',
  'Ekstraksi Konfirmasi Registrasi Visa',
  'Mengekstrak data terstruktur dari email/dokumen konfirmasi registrasi visa imigrasi',
  true
);

-- Pool assignments untuk visa_registration_extraction
DELETE FROM public.gw_field_pool_assignments
WHERE field_key = 'visa_registration_extraction';

INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier) VALUES
  ('visa_registration_extraction', 'gemini', 1),
  ('visa_registration_extraction', 'gpt',    2),
  ('visa_registration_extraction', 'claude', 3);

-- gw_field_specs (DELETE + INSERT agar aman tanpa butuh constraint)
DELETE FROM public.gw_field_specs WHERE field_key = 'visa_registration_extraction';
INSERT INTO public.gw_field_specs (field_key, system_prompt, output_schema)
VALUES (
  'visa_registration_extraction',
  'Kamu adalah mesin ekstraksi data dari email/dokumen konfirmasi registrasi visa yang dikirim oleh otoritas Imigrasi. Ekstrak HANYA field di skema berikut. Kembalikan null untuk nilai yang tidak ditemukan.',
  '{
    "registration_number": "string|null",
    "applicant_name": "string|null",
    "visa_type": "string|null",
    "submission_date": "YYYY-MM-DD|null",
    "additional_notes": "string|null",
    "is_valid": "boolean",
    "confidence_score": "number",
    "manual_review_required": "boolean",
    "warnings": "string[]"
  }'::jsonb
);
