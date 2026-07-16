-- ════════════════════════════════════════════════════════════════════════
-- MyAI OS Dedicated Gateway — Supabase PostgreSQL Schema Migration
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. gw_users ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'owner',
  created_at    timestamptz DEFAULT now()
);

-- ── 2. gw_client_apps ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_client_apps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  tier        text NOT NULL DEFAULT 'internal',
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz DEFAULT now()
);

-- ── 3. gw_api_keys ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_api_keys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_app_id     uuid REFERENCES public.gw_client_apps(id) ON DELETE CASCADE,
  key_prefix        text NOT NULL,
  key_hash          text NOT NULL,
  provider_scope    text[] DEFAULT '{claude,gpt,gemini}',
  rate_limit_per_day int,
  status            text NOT NULL DEFAULT 'active',
  created_at        timestamptz DEFAULT now(),
  last_used_at      timestamptz
);

-- ── 4. gw_usage_logs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_usage_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id        uuid REFERENCES public.gw_api_keys(id) ON DELETE SET NULL,
  app_name          text,
  provider          text NOT NULL,
  task_type         text NOT NULL,
  tokens_used       int NOT NULL DEFAULT 0,
  prompt_tokens     int DEFAULT 0,
  completion_tokens int DEFAULT 0,
  latency_ms        int DEFAULT 0,
  ip_address        text,
  field_key         text,
  pool_tier_used    integer,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gw_usage_logs_created_at_idx ON public.gw_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS gw_usage_logs_api_key_id_idx ON public.gw_usage_logs(api_key_id);

-- ── 5. gw_business_profile ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_business_profile (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL DEFAULT 'MyBusiness Ecosystem Core',
  content     text NOT NULL DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);

-- ── 6. gw_knowledge_documents ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_knowledge_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_app_id   uuid REFERENCES public.gw_client_apps(id) ON DELETE CASCADE,
  title           text NOT NULL,
  content         text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- ── 7. gw_provider_keys ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_provider_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL,
  label         text,
  key_encrypted text NOT NULL,
  status        text NOT NULL DEFAULT 'active',
  priority      int NOT NULL DEFAULT 0,
  usage_count   int NOT NULL DEFAULT 0,
  last_used_at  timestamptz,
  cooldown_until timestamptz DEFAULT NULL,
  consecutive_429_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- ── 8. gw_rate_limit_buckets ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_rate_limit_buckets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address    text NOT NULL,
  endpoint      text NOT NULL,
  count         int NOT NULL DEFAULT 1,
  window_start  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ip_address, endpoint)
);

CREATE INDEX IF NOT EXISTS gw_rate_limit_ip_endpoint_idx ON public.gw_rate_limit_buckets(ip_address, endpoint);

-- ── 9. gw_ai_fields ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_ai_fields (
  field_key     text PRIMARY KEY,
  display_name  text NOT NULL,
  description   text,
  auto_mode     boolean NOT NULL DEFAULT true
);

-- ── 10. gw_field_pool_assignments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_field_pool_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key     text NOT NULL REFERENCES public.gw_ai_fields(field_key) ON DELETE CASCADE,
  provider      text NOT NULL,
  pool_tier     int NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.gw_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_client_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_business_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_provider_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_ai_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gw_field_pool_assignments ENABLE ROW LEVEL SECURITY;

-- Deny direct browser/anonymous access (server uses service_role key to bypass)
CREATE POLICY "deny_anon_users" ON public.gw_users FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_client_apps" ON public.gw_client_apps FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_api_keys" ON public.gw_api_keys FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_usage_logs" ON public.gw_usage_logs FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_business_profile" ON public.gw_business_profile FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_knowledge_documents" ON public.gw_knowledge_documents FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_provider_keys" ON public.gw_provider_keys FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_rate_limit_buckets" ON public.gw_rate_limit_buckets FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_ai_fields" ON public.gw_ai_fields FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_field_pool_assignments" ON public.gw_field_pool_assignments FOR ALL TO anon USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Default Seeding
-- ════════════════════════════════════════════════════════════════════════

-- Seed: Business Profile
INSERT INTO public.gw_business_profile (title, content)
VALUES (
  'MyBusiness Ecosystem Core',
  E'MyBusiness is a multi-product ecosystem serving domestic and international clients.\n\nProducts:\n1. **Indonesian Visas** – Premium digital visa services.\n2. **Tropic Tech** – Bespoke IT consultation and cloud solutions.\n3. **MyBusiness Core Suite** – Main website, Playstore app, and Appstore app.\n\nAll products consume centralized AI services through the MyAI OS Gateway.'
)
ON CONFLICT DO NOTHING;

-- Seed: Default Fields
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

-- Seed: Default Pool Assignments
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
  ('chatbot', 'deepseek', 3)
ON CONFLICT DO NOTHING;
