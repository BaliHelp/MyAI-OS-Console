import { supabaseAdmin } from "./supabase";
import { embedText } from "./embedding-adapters/gemini-embedding";

/**
 * Generate an embedding for a newly-created gw_knowledge_documents row and attach it via
 * UPDATE. Called as a fire-and-forget side effect after insert (same "don't let a side-effect
 * block the primary write" convention as markGeminiKeySuccess(...).catch(() => {}) elsewhere in
 * this codebase) — a document that fails to embed still saved successfully, it just won't
 * surface in semantic search (see match_knowledge_documents in
 * supabase/migrations/20260826200000_knowledge_documents_embeddings.sql) until backfilled or
 * retried. Never throws.
 */
export async function generateAndAttachEmbedding(documentId: string, content: string): Promise<void> {
  if (!supabaseAdmin || !documentId || !content) return;

  try {
    const embedding = await embedText(content);
    if (!embedding) return;

    const { error } = await supabaseAdmin
      .from("gw_knowledge_documents")
      .update({ embedding })
      .eq("id", documentId);

    if (error) {
      console.warn(`[knowledge] Failed to attach embedding for document ${documentId}:`, error.message);
    }
  } catch (err: any) {
    console.warn(`[knowledge] Exception generating embedding for document ${documentId}:`, err.message || err);
  }
}
