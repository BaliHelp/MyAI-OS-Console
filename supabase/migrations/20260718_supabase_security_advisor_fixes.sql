-- ════════════════════════════════════════════════════════════════════════
-- Migration: Fix Supabase Security Advisor warnings for public.rls_auto_enable()
-- Run this in Supabase SQL Editor to resolve the security warnings immediately.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Cabut hak eksekusi dari PUBLIC (semua user secara umum)
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;

-- 2. Cabut hak eksekusi dari role anon (anonymous/non-login)
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;

-- 3. Cabut hak eksekusi dari role authenticated (user terautentikasi biasa)
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- 4. Batasi agar hanya postgres, service_role, dan superuser yang dapat mengeksekusi
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
