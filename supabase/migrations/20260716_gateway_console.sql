-- ════════════════════════════════════════════════════════════════════════
-- MyAI OS Console — Supabase PostgreSQL Migration (Public Schema, Prefixed Tables)
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. gw_users (admin authentication) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,         -- bcrypt hash or plaintext
  role          text NOT NULL DEFAULT 'owner',
  created_at    timestamptz DEFAULT now()
);

-- ── 2. gw_client_apps ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_client_apps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  tier        text NOT NULL DEFAULT 'internal', -- 'internal' | 'community'
  status      text NOT NULL DEFAULT 'active',   -- 'active' | 'inactive'
  created_at  timestamptz DEFAULT now()
);

-- ── 3. gw_api_keys ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_api_keys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_app_id     uuid REFERENCES public.gw_client_apps(id) ON DELETE CASCADE,
  key_prefix        text NOT NULL,         -- visible prefix e.g. "sk_visas_a8f3"
  key_hash          text NOT NULL,         -- SHA-256 of full key, never plaintext
  provider_scope    text[] DEFAULT '{claude,gpt,gemini}',
  rate_limit_per_day int,                  -- NULL = unlimited
  status            text NOT NULL DEFAULT 'active', -- 'active' | 'revoked'
  created_at        timestamptz DEFAULT now(),
  last_used_at      timestamptz
);

-- ── 4. gw_usage_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_usage_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id        uuid REFERENCES public.gw_api_keys(id) ON DELETE SET NULL,
  app_name          text,                  -- denormalized
  provider          text NOT NULL,         -- 'claude' | 'gpt' | 'gemini'
  task_type         text NOT NULL,         -- 'text' | 'image' | 'audio' | 'embeddings'
  tokens_used       int NOT NULL DEFAULT 0,
  prompt_tokens     int DEFAULT 0,
  completion_tokens int DEFAULT 0,
  latency_ms        int DEFAULT 0,
  ip_address        text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gw_usage_logs_created_at_idx ON public.gw_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS gw_usage_logs_api_key_id_idx ON public.gw_usage_logs(api_key_id);

-- ── 5. gw_business_profile ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_business_profile (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL DEFAULT 'MyBusiness Ecosystem Core',
  content     text NOT NULL DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);

-- ── 6. gw_knowledge_documents ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_knowledge_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_app_id   uuid REFERENCES public.gw_client_apps(id) ON DELETE CASCADE,
  title           text NOT NULL,
  content         text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- ── 7. gw_provider_keys ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_provider_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL,             -- 'gemini' | 'claude' | 'gpt'
  label         text,
  key_encrypted text NOT NULL,             -- AES-256-CBC: "iv:ciphertext"
  status        text NOT NULL DEFAULT 'active',
  priority      int NOT NULL DEFAULT 0,
  usage_count   int NOT NULL DEFAULT 0,
  last_used_at  timestamptz,
  cooldown_until timestamptz DEFAULT NULL,
  consecutive_429_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- ── 8. gw_rate_limit_buckets ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_rate_limit_buckets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address    text NOT NULL,
  endpoint      text NOT NULL,
  count         int NOT NULL DEFAULT 1,
  window_start  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ip_address, endpoint)
);

CREATE INDEX IF NOT EXISTS gw_rate_limit_ip_endpoint_idx ON public.gw_rate_limit_buckets(ip_address, endpoint);

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

-- Deny direct browser/anonymous access (server uses service_role key to bypass)
CREATE POLICY "deny_anon_users" ON public.gw_users FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_client_apps" ON public.gw_client_apps FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_api_keys" ON public.gw_api_keys FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_usage_logs" ON public.gw_usage_logs FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_business_profile" ON public.gw_business_profile FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_knowledge_documents" ON public.gw_knowledge_documents FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_provider_keys" ON public.gw_provider_keys FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_rate_limit_buckets" ON public.gw_rate_limit_buckets FOR ALL TO anon USING (false);

-- ════════════════════════════════════════════════════════════════════════
-- Seed: Initial business profile
-- ════════════════════════════════════════════════════════════════════════
INSERT INTO public.gw_business_profile (title, content)
VALUES (
  'MyBusiness Ecosystem Core',
  E'MyBusiness is a multi-product ecosystem serving domestic and international clients.\n\nProducts:\n1. **Indonesian Visas** – Premium digital visa services.\n2. **Tropic Tech** – Bespoke IT consultation and cloud solutions.\n3. **MyBusiness Core Suite** – Main website, Playstore app, and Appstore app.\n\nAll products consume centralized AI services through the MyAI OS Gateway.'
)
ON CONFLICT DO NOTHING;
