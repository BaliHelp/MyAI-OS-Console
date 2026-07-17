-- ════════════════════════════════════════════════════════════════════════
-- Migration: gw_chat_personas table + seed Indonesian Visas persona
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Buat tabel gw_chat_personas ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_chat_personas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_app_id    uuid NOT NULL REFERENCES public.gw_client_apps(id) ON DELETE CASCADE,
  persona_name     text NOT NULL,
  tone_description text NOT NULL DEFAULT '',
  language_default text NOT NULL DEFAULT 'id',
  must_never_say   text[] NOT NULL DEFAULT '{}',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Index untuk lookup cepat per client app
CREATE UNIQUE INDEX IF NOT EXISTS gw_chat_personas_client_app_idx
  ON public.gw_chat_personas (client_app_id);

COMMENT ON TABLE public.gw_chat_personas IS
  'Satu persona chatbot per client app, di-inject ke system_prompt field chat (chatbot_general, chatbot_checkout).';

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.gw_chat_personas ENABLE ROW LEVEL SECURITY;

-- Anon tidak boleh membaca sama sekali
DROP POLICY IF EXISTS "deny_anon_chat_personas" ON public.gw_chat_personas;
CREATE POLICY "deny_anon_chat_personas" ON public.gw_chat_personas
  FOR ALL TO anon USING (false);

-- Admin (role = 'owner' di gw_users) bisa akses semua via Supabase Auth session
DROP POLICY IF EXISTS "admin_access_chat_personas" ON public.gw_chat_personas;
CREATE POLICY "admin_access_chat_personas" ON public.gw_chat_personas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gw_users u
      WHERE u.email = auth.jwt() ->> 'email'
        AND u.role = 'owner'
    )
  );

-- ── 3. Seed persona pertama: MyVISA AI (Indonesian Visas) ─────────────────
-- Gunakan client_app_id yang sudah diketahui: d544c3f5-89bd-4983-8387-6d85d954050f
INSERT INTO public.gw_chat_personas (
  client_app_id,
  persona_name,
  tone_description,
  language_default,
  must_never_say
) VALUES (
  'd544c3f5-89bd-4983-8387-6d85d954050f',
  'MyVISA AI',
  'Senior Immigration Sales Consultant. Ringkas, profesional, ramah, selalu regulation-first (mengutamakan aturan resmi).',
  'id',
  ARRAY[
    'Menjanjikan persetujuan visa',
    'Menjanjikan estimasi waktu proses yang pasti',
    'Klaim yang menyesatkan soal proses imigrasi'
  ]
)
ON CONFLICT (client_app_id) DO UPDATE SET
  persona_name     = EXCLUDED.persona_name,
  tone_description = EXCLUDED.tone_description,
  language_default = EXCLUDED.language_default,
  must_never_say   = EXCLUDED.must_never_say,
  updated_at       = now();
