-- Widen gw_data_center.source_type to allow the values the chatbot/content
-- transcript logging path in app/api/v1/chat/completions/route.ts has always
-- attempted to insert ('chatbot_interaction', 'content_generation'). The
-- original CHECK constraint (20260717_data_center.sql) only allowed
-- 'ocr_upload' | 'url_scrape' | 'manual_document' | 'chat_memory_fact', so
-- every chatbot/content logging attempt has failed silently at the DB layer
-- since that logging code was added (2026-07-18) — confirmed via runtime
-- error logs: "violates check constraint gw_data_center_source_type_check".
-- Purely additive (widens an existing constraint, no data/shape change) and
-- idempotent — safe to re-run.

ALTER TABLE public.gw_data_center
  DROP CONSTRAINT IF EXISTS gw_data_center_source_type_check;

ALTER TABLE public.gw_data_center
  ADD CONSTRAINT gw_data_center_source_type_check
  CHECK (source_type IN (
    'ocr_upload',
    'url_scrape',
    'manual_document',
    'chat_memory_fact',
    'chatbot_interaction',
    'content_generation'
  ));
