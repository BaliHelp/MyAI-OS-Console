-- ── 1. Seed gw_ai_fields with new and updated fields ──────────────────────
INSERT INTO public.gw_ai_fields (field_key, display_name, description, auto_mode) VALUES
  ('content_generation', 'Asisten Pembuat Konten', 'Membuat draf artikel blog imigrasi', true),
  ('ocr_photo_validation', 'Validasi Kelayakan Foto Wajah', 'Memeriksa kualitas teknis foto wajah', true),
  ('coding_assistant', 'Asisten Pemrograman Kode', 'Menulis, memperbaiki, dan menjelaskan kode', true),
  ('chatbot_general', 'Chatbot Tanya Jawab Umum', 'Melayani pertanyaan umum pelanggan', true),
  ('chatbot_checkout', 'Chatbot Alur Pembayaran/Checkout', 'Membantu pelanggan menyelesaikan order', true)
ON CONFLICT (field_key) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  auto_mode = EXCLUDED.auto_mode;

-- ── 2. Update gw_field_pool_assignments with precise tiers ───────────────
-- Clear existing assignments for the affected fields
DELETE FROM public.gw_field_pool_assignments 
WHERE field_key IN (
  'ocr_id_document', 'ocr_travel_document', 'ocr_financial_document', 'ocr_general_document',
  'ocr_photo_validation', 'content_generation', 'coding_assistant',
  'chatbot_general', 'chatbot_checkout', 'reasoning_general', 'orchestrator'
);

-- Insert correct tiers
INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier) VALUES
  -- OCR Fields (tier 1=gemini, 2=deepseek, 3=grok, 4=gemini loopback)
  ('ocr_id_document', 'gemini', 1),
  ('ocr_id_document', 'deepseek', 2),
  ('ocr_id_document', 'grok', 3),
  ('ocr_id_document', 'gemini', 4),

  ('ocr_travel_document', 'gemini', 1),
  ('ocr_travel_document', 'deepseek', 2),
  ('ocr_travel_document', 'grok', 3),
  ('ocr_travel_document', 'gemini', 4),

  ('ocr_financial_document', 'gemini', 1),
  ('ocr_financial_document', 'deepseek', 2),
  ('ocr_financial_document', 'grok', 3),
  ('ocr_financial_document', 'gemini', 4),

  ('ocr_general_document', 'gemini', 1),
  ('ocr_general_document', 'deepseek', 2),
  ('ocr_general_document', 'grok', 3),
  ('ocr_general_document', 'gemini', 4),

  ('ocr_photo_validation', 'gemini', 1),
  ('ocr_photo_validation', 'deepseek', 2),
  ('ocr_photo_validation', 'grok', 3),
  ('ocr_photo_validation', 'gemini', 4),

  -- Content Generation
  ('content_generation', 'gpt', 1),
  ('content_generation', 'claude', 2),

  -- Coding Assistant
  ('coding_assistant', 'claude', 1),
  ('coding_assistant', 'gpt', 2),

  -- Chatbots (tier 1=gpt, 2=claude, 3=deepseek)
  ('chatbot_general', 'gpt', 1),
  ('chatbot_general', 'claude', 2),
  ('chatbot_general', 'deepseek', 3),

  ('chatbot_checkout', 'gpt', 1),
  ('chatbot_checkout', 'claude', 2),
  ('chatbot_checkout', 'deepseek', 3),

  -- Reasoning & Orchestrator (tier 1=claude, 2=gpt)
  ('reasoning_general', 'claude', 1),
  ('reasoning_general', 'gpt', 2),

  ('orchestrator', 'claude', 1),
  ('orchestrator', 'gpt', 2);

-- ── 3. Create gw_field_specs table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_field_specs (
  field_key     text PRIMARY KEY REFERENCES public.gw_ai_fields(field_key) ON DELETE CASCADE,
  system_prompt text NOT NULL,
  output_schema jsonb,
  example_input_description text,
  example_output jsonb,
  updated_at    timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gw_field_specs ENABLE ROW LEVEL SECURITY;

-- Policy (bypassed by service role)
DROP POLICY IF EXISTS "deny_anon_field_specs" ON public.gw_field_specs;
CREATE POLICY "deny_anon_field_specs" ON public.gw_field_specs FOR ALL TO anon USING (false);

-- ── 4. Seed gw_field_specs with prompt requirements ──────────────────────
INSERT INTO public.gw_field_specs (field_key, system_prompt, output_schema) VALUES
  (
    'ocr_id_document',
    'Kamu adalah mesin ekstraksi OCR khusus dokumen identitas (paspor, KTP, SIM, KITAS, atau ID resmi lainnya). Ekstrak HANYA field yang ada di skema JSON berikut. Jangan menebak nilai yang tidak terbaca jelas — kembalikan null dan tambahkan catatan di warnings. Jangan pernah mengeluarkan teks apapun di luar objek JSON. Jika gambar tidak terlihat seperti dokumen identitas sama sekali, set is_valid ke false dan kosongkan field lain.',
    '{"document_type": "passport|national_id|drivers_license|kitas|other_id", "first_name": "string|null", "last_name": "string|null", "full_name": "string|null", "document_number": "string|null", "date_of_birth": "YYYY-MM-DD|null", "nationality": "string|null", "gender": "M|F|X|unknown", "issued_date": "YYYY-MM-DD|null", "expiry_date": "YYYY-MM-DD|null", "issuing_authority": "string|null", "issuing_country": "string|null", "visa_type": "string|null", "is_valid": "boolean", "confidence_score": "number", "manual_review_required": "boolean", "warnings": "string[]"}'::jsonb
  ),
  (
    'ocr_travel_document',
    'Kamu adalah mesin ekstraksi OCR khusus dokumen perjalanan (tiket pesawat, boarding pass, atau itinerary). Ekstrak HANYA field di skema berikut. Kembalikan null untuk nilai yang tidak terbaca. Jangan keluarkan teks di luar JSON.',
    '{"document_type": "flight_ticket|boarding_pass|itinerary|other_travel", "passenger_name": "string|null", "flight_number": "string|null", "airline": "string|null", "departure_airport": "string|null", "arrival_airport": "string|null", "departure_date": "YYYY-MM-DD|null", "departure_time": "HH:MM|null", "arrival_date": "YYYY-MM-DD|null", "arrival_time": "HH:MM|null", "booking_reference": "string|null", "is_valid": "boolean", "confidence_score": "number", "manual_review_required": "boolean", "warnings": "string[]"}'::jsonb
  ),
  (
    'ocr_financial_document',
    'Kamu adalah mesin ekstraksi OCR khusus dokumen keuangan (rekening koran/bank statement atau bukti transaksi). Ekstrak HANYA field di skema berikut sesuai document_type yang terdeteksi. Untuk nomor rekening, kembalikan HANYA 4 digit terakhir (format ****1234) — jangan pernah kembalikan nomor rekening penuh. Kembalikan null untuk nilai yang tidak terbaca.',
    '{"document_type": "bank_statement|transaction_receipt|other_financial", "account_holder_name": "string|null", "sender_name": "string|null", "bank_name": "string|null", "account_number_masked": "string|null", "statement_period_start": "YYYY-MM-DD|null", "statement_period_end": "YYYY-MM-DD|null", "closing_balance": "number|null", "amount": "number|null", "currency": "string|null", "transaction_id": "string|null", "transaction_date": "YYYY-MM-DD|null", "is_valid": "boolean", "confidence_score": "number", "manual_review_required": "boolean", "warnings": "string[]"}'::jsonb
  ),
  (
    'ocr_general_document',
    'Kamu adalah mesin ekstraksi OCR untuk dokumen umum (CV, kontrak kerja, surat undangan, reservasi akomodasi, atau itinerary). Ekstrak field sesuai document_type. Untuk summary, buat ringkasan 1-2 kalimat dalam bahasa yang sama dengan dokumen asli. Kembalikan null untuk nilai yang tidak terbaca.',
    '{"document_type": "cv_resume|work_contract|invitation_letter|itinerary|hotel_booking|other", "title": "string|null", "primary_name": "string|null", "accommodation_name": "string|null", "indonesia_address": "string|null", "check_in_date": "YYYY-MM-DD|null", "check_out_date": "YYYY-MM-DD|null", "key_dates": "array|null", "summary": "string|null", "is_valid": "boolean", "confidence_score": "number", "manual_review_required": "boolean", "warnings": "string[]"}'::jsonb
  ),
  (
    'ocr_photo_validation',
    'Kamu adalah validator foto upload. Periksa apakah gambar ini menunjukkan foto wajah manusia yang jelas dan layak digunakan sebagai foto profil/identitas. Jangan mengidentifikasi siapa orangnya — hanya menilai kelayakan teknis foto.',
    '{"is_valid_face_photo": "boolean", "quality_issues": "string[]", "confidence_score": "number"}'::jsonb
  ),
  (
    'content_generation',
    'Kamu adalah asisten penulis konten untuk blog/berita resmi Indonesian Visas (Immigration Update). Cari topik relevan seputar regulasi imigrasi Indonesia dan tulis draf artikel informatif dan sesuai fakta, tanpa klaim jaminan hasil visa.',
    '{"title": "string", "summary": "string", "content": "string", "suggested_category": "string|null", "sources_referenced": "string[]"}'::jsonb
  ),
  (
    'coding_assistant',
    'Kamu adalah asisten coding yang membantu menulis, menjelaskan, atau memperbaiki kode. Ikuti instruksi pengguna secara langsung.',
    NULL
  ),
  (
    'chatbot_general',
    'Kamu adalah asisten AI untuk [nama aplikasi pemanggil]. Jawab dengan jelas dan profesional.',
    NULL
  ),
  (
    'chatbot_checkout',
    'Kamu adalah asisten AI untuk [nama aplikasi pemanggil]. Jawab dengan jelas dan profesional.',
    NULL
  ),
  (
    'reasoning_general',
    'Kamu adalah asisten AI untuk [nama aplikasi pemanggil]. Jawab dengan jelas dan profesional.',
    NULL
  ),
  (
    'orchestrator',
    'Kamu adalah asisten AI untuk [nama aplikasi pemanggil]. Jawab dengan jelas dan profesional.',
    NULL
  )
ON CONFLICT (field_key) DO UPDATE SET 
  system_prompt = EXCLUDED.system_prompt,
  output_schema = EXCLUDED.output_schema,
  updated_at = now();
