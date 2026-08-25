-- Phase 2 dari rencana embedding (lihat commit sebelumnya untuk Phase 1 di
-- gw_knowledge_documents). Kolom `embedding vector(1536)` di gw_data_center sudah ada sejak
-- 20260717_data_center.sql tapi belum pernah dipakai — belum ada index, belum ada RPC
-- similarity-search. Ini melengkapi infrastrukturnya, mengikuti pola persis
-- 20260826200000_knowledge_documents_embeddings.sql.

CREATE INDEX IF NOT EXISTS gw_data_center_embedding_idx
  ON public.gw_data_center
  USING hnsw (embedding extensions.vector_cosine_ops);

-- Scoping mengikuti aturan visibilitas yang sudah ada di tabel ini: client_app_id NULL = data
-- internal/global, selain itu di-scope ke app tersebut (lihat kolom client_app_id di
-- 20260717_data_center.sql). filter_client_app_id NULL berarti "tanpa batasan app" (dipakai
-- dashboard admin yang melihat semua record) — beda dari gw_knowledge_documents yang punya 2
-- fungsi terpisah untuk 2 semantik NULL yang berbeda, di sini cukup 1 fungsi karena satu-satunya
-- pemanggil saat ini (DataCenterTab, admin-only) selalu ingin melihat semua record.
CREATE OR REPLACE FUNCTION public.match_data_center_records(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 8,
  filter_client_app_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  client_app_id uuid,
  field_key text,
  source_type text,
  document_type text,
  raw_text text,
  extracted_data jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    gdc.id,
    gdc.client_app_id,
    gdc.field_key,
    gdc.source_type,
    gdc.document_type,
    gdc.raw_text,
    gdc.extracted_data,
    gdc.created_at,
    1 - (gdc.embedding <=> query_embedding) AS similarity
  FROM public.gw_data_center gdc
  WHERE gdc.embedding IS NOT NULL
    AND (filter_client_app_id IS NULL OR gdc.client_app_id IS NULL OR gdc.client_app_id = filter_client_app_id)
  ORDER BY gdc.embedding <=> query_embedding
  LIMIT match_count;
$$;
