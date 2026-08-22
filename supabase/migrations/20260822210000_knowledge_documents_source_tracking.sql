-- Adds source_url + updated_at to gw_knowledge_documents.
--
-- Bug found while building the Indonesian Visas unified Knowledge Base sync
-- (app/api/cron/sync-knowledge/route.ts, lib/knowledge-sync-indonesian-visas.ts):
-- app/api/knowledge/import-url/route.ts has always inserted a `source_url` field into this
-- table, but the column never existed — every "import from URL" via the dashboard would have
-- failed with a Postgres "column does not exist" error. source_url is also the dedup key the
-- new cron sync uses to replace a source's document on every scheduled run instead of
-- accumulating duplicates.
--
-- Already applied directly to production on 2026-08-22 via mcp Supabase apply_migration;
-- this file documents/reproduces it in git history.

ALTER TABLE public.gw_knowledge_documents
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS gw_knowledge_documents_source_url_idx
  ON public.gw_knowledge_documents (client_app_id, source_url);
