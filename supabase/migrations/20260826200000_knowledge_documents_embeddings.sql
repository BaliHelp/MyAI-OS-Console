-- Semantic search for gw_knowledge_documents. Today, every chatbot/OCR field in
-- /api/v1/chat/completions fetches EVERY row unfiltered and dumps it into the system prompt
-- (see app/api/v1/chat/completions/route.ts ~line 301) — a comment in that same file already
-- documents this having hit ~115KB/~30k tokens per request for one app, enough to blow past
-- OpenAI's per-minute token limit for tools-mode requests. This adds the vector column + a
-- similarity-search RPC so retrieval can fetch only the top-K relevant documents instead.
--
-- pgvector is already enabled (see 20260717_data_center.sql) and later moved to the
-- `extensions` schema (20260718_supabase_security_advisor_fixes.sql), so `vector` is referenced
-- as `extensions.vector` here to avoid relying on search_path.
--
-- Dimension 1536 matches gw_data_center.embedding (same table shape, same
-- gemini-embedding-2 model with output_dimensionality=1536 — see
-- lib/embedding-adapters/gemini-embedding.ts) for consistency across the two tables that use it.

ALTER TABLE public.gw_knowledge_documents
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

-- HNSW over ivfflat — no "lists" parameter to tune against row count, and this table is small
-- enough that build time is a non-issue. Cosine ops to match the `<=>` operator used below.
CREATE INDEX IF NOT EXISTS gw_knowledge_documents_embedding_idx
  ON public.gw_knowledge_documents
  USING hnsw (embedding extensions.vector_cosine_ops);

-- Mirrors the exact visibility rule already implemented in-memory in
-- app/api/v1/chat/completions/route.ts (filteredDocs: !d.client_app_id || d.client_app_id ===
-- keyData.client_app_id) — global docs (client_app_id IS NULL) are visible to every caller,
-- app-scoped docs only to that app. Rows with no embedding yet (not backfilled, or embedding
-- generation failed) are excluded rather than returned with a meaningless similarity score.
CREATE OR REPLACE FUNCTION public.match_knowledge_documents(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 8,
  filter_client_app_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  client_app_id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    gkd.id,
    gkd.client_app_id,
    gkd.title,
    gkd.content,
    1 - (gkd.embedding <=> query_embedding) AS similarity
  FROM public.gw_knowledge_documents gkd
  WHERE gkd.embedding IS NOT NULL
    AND (gkd.client_app_id IS NULL OR gkd.client_app_id = filter_client_app_id)
  ORDER BY gkd.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Unscoped variant for the internal admin helper (app/api/gemini/query-knowledge/route.ts) —
-- that endpoint is admin-only (no calling client_app_id to scope by) and today sees every
-- document regardless of app. Kept as a separate function rather than overloading
-- match_knowledge_documents with a "null filter = no restriction" behavior, since passing NULL
-- as filter_client_app_id there would (correctly, for the per-app caller) exclude every
-- app-scoped document via standard SQL NULL comparison semantics — reusing that same NULL for
-- "no restriction" here would silently do the opposite of what this endpoint needs.
CREATE OR REPLACE FUNCTION public.match_knowledge_documents_all(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  client_app_id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    gkd.id,
    gkd.client_app_id,
    gkd.title,
    gkd.content,
    1 - (gkd.embedding <=> query_embedding) AS similarity
  FROM public.gw_knowledge_documents gkd
  WHERE gkd.embedding IS NOT NULL
  ORDER BY gkd.embedding <=> query_embedding
  LIMIT match_count;
$$;
