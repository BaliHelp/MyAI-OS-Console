-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the Data Center table
CREATE TABLE IF NOT EXISTS public.gw_data_center (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_app_id           uuid REFERENCES public.gw_client_apps(id) ON DELETE SET NULL,
  field_key               text,
  source_type             text NOT NULL CHECK (source_type IN ('ocr_upload', 'url_scrape', 'manual_document', 'chat_memory_fact')),
  source_url              text,
  document_type           text,
  extracted_data          jsonb,
  raw_text                text,
  language                text,
  tags                    text[],
  file_url                text,
  embedding               vector(1536),
  manual_review_required  boolean NOT NULL DEFAULT false,
  confidence_score        numeric,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gw_data_center ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "client_app_access" ON public.gw_data_center;
DROP POLICY IF EXISTS "admin_access" ON public.gw_data_center;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE ON SECURITY POSTURE
-- All gateway application reads and writes use SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS entirely. These policies are defense-in-depth safeguards
-- for direct PostgREST access attempts. Because this project was created with
-- "Automatically expose new tables" disabled, the anon/authenticated roles have
-- no GRANTs on this table, so direct REST API access fails at the PostgreSQL
-- permission layer before RLS even runs.
-- Primary protection = service-role-only access + app-layer session/key auth.
-- ─────────────────────────────────────────────────────────────────────────────

-- Policy 1: Client App Access (matches request header hashed api key)
-- Only applies if anon/authenticated roles are explicitly granted access to this table.
CREATE POLICY "client_app_access" ON public.gw_data_center
FOR ALL
TO anon, authenticated
USING (
  client_app_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.gw_api_keys k
    WHERE k.client_app_id = gw_data_center.client_app_id
      AND k.key_hash = encode(
        sha256(
          COALESCE(
            substring(current_setting('request.headers', true)::json->>'authorization' from 8),
            current_setting('request.headers', true)::json->>'x-api-key'
          )::bytea
        ),
        'hex'
      )
      AND k.status = 'active'
  )
);

-- Policy 2: Admin Access
-- Checks the gw_users table for role='owner' rather than hardcoding an email,
-- so adding a second admin or changing login email doesn't break this policy.
-- auth.jwt() refers to Supabase Auth JWTs (not the custom session JWTs issued
-- by this application), so this only activates for direct Supabase Auth sessions.
CREATE POLICY "admin_access" ON public.gw_data_center
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gw_users u
    WHERE u.email = auth.jwt() ->> 'email'
      AND u.role = 'owner'
  )
);
