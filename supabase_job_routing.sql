-- ── 1. Create gw_ai_fields table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_ai_fields (
  field_key     text PRIMARY KEY,
  display_name  text NOT NULL,
  description   text,
  auto_mode     boolean NOT NULL DEFAULT true
);

-- ── 2. Create gw_field_pool_assignments table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_field_pool_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key     text NOT NULL REFERENCES public.gw_ai_fields(field_key) ON DELETE CASCADE,
  provider      text NOT NULL, -- 'gemini' | 'gpt' | 'claude' | 'grok' | 'deepseek'
  pool_tier     int NOT NULL,  -- 1 = primary, 2 = first overflow, 3 = second overflow
  created_at    timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gw_ai_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_field_pool_assignments ENABLE ROW LEVEL SECURITY;

-- Deny direct anon access (server uses service_role key to bypass)
CREATE POLICY "deny_anon_ai_fields" ON public.gw_ai_fields FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_field_pool_assignments" ON public.gw_field_pool_assignments FOR ALL TO anon USING (false);

-- ── 3. Seed default fields (auto_mode = true) ───────────────────────────
INSERT INTO public.gw_ai_fields (field_key, display_name, description, auto_mode) VALUES
  ('ocr_id_document', 'Passport, KTP, dan ID lainnya', 'Mengekstrak data identitas resmi', true),
  ('ocr_travel_document', 'Flight ticket, boarding pass, itinerary perjalanan', 'Mengekstrak data perjalanan', true),
  ('ocr_financial_document', 'Bank statement dan dokumen transaksi', 'Mengekstrak data keuangan', true),
  ('ocr_general_document', 'CV, kontrak kerja, dokumen umum lainnya', 'Mengekstrak data teks umum', true),
  ('orchestrator', 'Koordinasi antar-agent dan keputusan routing', 'Otak utama orkestrasi agent', true),
  ('chatbot', 'Chat widget customer-facing', 'Widget chat interaktif pelanggan', true),
  ('reasoning_general', 'Analisis dan pengambilan keputusan kompleks', 'Penalaran tingkat tinggi', true),
  ('face_liveness_scan', 'reserved placeholder only', 'Pencocokan biometrik wajah (non-aktif)', false)
ON CONFLICT (field_key) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  auto_mode = EXCLUDED.auto_mode;

-- ── 4. Seed default pool assignments ────────────────────────────────────
-- All ocr_* fields: tier 1 = gemini, tier 2 = gpt
-- orchestrator, reasoning_general: tier 1 = claude, tier 2 = gpt
-- chatbot: tier 1 = gpt, tier 2 = claude, tier 3 = deepseek

DELETE FROM public.gw_field_pool_assignments;

INSERT INTO public.gw_field_pool_assignments (field_key, provider, pool_tier) VALUES
  ('ocr_id_document', 'gemini', 1),
  ('ocr_id_document', 'gpt', 2),
  ('ocr_travel_document', 'gemini', 1),
  ('ocr_travel_document', 'gpt', 2),
  ('ocr_financial_document', 'gemini', 1),
  ('ocr_financial_document', 'gpt', 2),
  ('ocr_general_document', 'gemini', 1),
  ('ocr_general_document', 'gpt', 2),
  ('orchestrator', 'claude', 1),
  ('orchestrator', 'gpt', 2),
  ('reasoning_general', 'claude', 1),
  ('reasoning_general', 'gpt', 2),
  ('chatbot', 'gpt', 1),
  ('chatbot', 'claude', 2),
  ('chatbot', 'deepseek', 3);

-- Add column if not exists to gw_usage_logs
ALTER TABLE public.gw_usage_logs ADD COLUMN IF NOT EXISTS field_key text;
ALTER TABLE public.gw_usage_logs ADD COLUMN IF NOT EXISTS pool_tier_used integer;

-- Add cooldown columns to gw_provider_keys
ALTER TABLE public.gw_provider_keys ADD COLUMN IF NOT EXISTS cooldown_until timestamptz DEFAULT NULL;
ALTER TABLE public.gw_provider_keys ADD COLUMN IF NOT EXISTS consecutive_429_count integer NOT NULL DEFAULT 0;
