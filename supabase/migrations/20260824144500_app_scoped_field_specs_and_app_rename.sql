-- ════════════════════════════════════════════════════════════════════════
-- Migration: Persona per-aplikasi (app-scoped field specs) + rename app editor
--
-- WHY: gw_field_specs bersifat GLOBAL (field_key = PRIMARY KEY, satu baris per
-- field, dipakai SEMUA aplikasi). Spec field 'content_generation' meng-hardcode
-- persona "Indonesian Visas (Immigration Update)" sehingga setiap aplikasi yang
-- memanggil field itu — termasuk MyAI Code/Developer lewat council — mendapat
-- persona visa. Itu salah: persona Indonesian Visas hanya untuk aplikasi
-- Indonesian Visas (prinsip: persona milik APLIKASI, bukan field bersama).
--
-- Perbaikan:
-- 1. Tabel baru gw_app_field_specs (field_key + client_app_id = PK) untuk
--    spec/persona KHUSUS aplikasi; tabel global tetap untuk spec netral.
-- 2. Pindahkan persona visa content_generation ke baris app Indonesian Visas.
-- 3. Netralkan spec global content_generation (pakai placeholder [nama aplikasi
--    pemanggil] supaya tiap aplikasi dapat nama sendiri).
-- 4. Ganti nama aplikasi client editor: "MyAI Developer" -> "MyAI Code"
--    (nama lama sebelum rebrand; slug teknis tetap 'myai-developer').
--
-- Idempotent — aman dijalankan ulang. Jalankan di Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Tabel spec khusus aplikasi ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gw_app_field_specs (
  field_key     text        NOT NULL REFERENCES public.gw_ai_fields(field_key) ON DELETE CASCADE,
  client_app_id uuid        NOT NULL REFERENCES public.gw_client_apps(id) ON DELETE CASCADE,
  system_prompt text        NOT NULL,
  output_schema jsonb,
  updated_at    timestamptz DEFAULT now(),
  PRIMARY KEY (field_key, client_app_id)
);

ALTER TABLE public.gw_app_field_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_anon_app_field_specs" ON public.gw_app_field_specs;
CREATE POLICY "deny_anon_app_field_specs" ON public.gw_app_field_specs FOR ALL TO anon USING (false);

-- ── 2. Pindahkan persona visa content_generation ke Indonesian Visas ─────
INSERT INTO public.gw_app_field_specs (field_key, client_app_id, system_prompt, output_schema)
SELECT 'content_generation',
       'd544c3f5-89bd-4983-8387-6d85d954050f', -- Indonesian Visas
       system_prompt,
       output_schema
FROM public.gw_field_specs
WHERE field_key = 'content_generation'
ON CONFLICT (field_key, client_app_id) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  output_schema = EXCLUDED.output_schema,
  updated_at    = now();

-- ── 3. Netralkan spec global content_generation ──────────────────────────
UPDATE public.gw_field_specs
SET system_prompt = 'Kamu adalah asisten penulis konten untuk [nama aplikasi pemanggil]. Cari topik yang relevan dan tulis draf artikel informatif, akurat, dan sesuai fakta. Hindari klaim jaminan hasil.',
    updated_at    = now()
WHERE field_key = 'content_generation';

-- ── 4. Rename aplikasi editor: MyAI Developer -> MyAI Code ───────────────
UPDATE public.gw_client_apps
SET name = 'MyAI Code'
WHERE slug = 'myai-developer';
