import {
  getAvailableGeminiKeys,
  markGeminiKeySuccess,
  markGeminiKey429,
  markGeminiKeyInvalid,
} from "@/lib/gemini-key-pool";

// Current Gemini embedding model — default output is 3072 dimensions, but the API supports
// truncating via `output_dimensionality`. Google's own docs recommend 768/1536/3072; 1536 is
// used here to match the `embedding vector(1536)` column already present in gw_data_center
// (supabase/migrations/20260717_data_center.sql) and now also added to gw_knowledge_documents.
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Embed a text string into a 1536-dimension vector using Gemini's embedding API. Reuses the
 * same shared Gemini key pool as lib/image-adapters/gemini-image.ts — Google doesn't scope a
 * key to specific models, so no separate key/gw_provider_keys row is needed.
 *
 * Best-effort: returns null (never throws) on any failure, so callers can treat embedding as an
 * optional side-effect that must never block a document save or a chat request — see
 * createKnowledgeDocument() in lib/knowledge.ts.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let candidates;
  try {
    candidates = await getAvailableGeminiKeys();
  } catch (err) {
    console.warn("[gemini-embedding] Failed to load key pool:", err);
    return null;
  }

  if (candidates.length === 0) {
    console.warn("[gemini-embedding] No Gemini API keys configured.");
    return null;
  }

  for (const candidate of candidates) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${candidate.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text: trimmed }] },
            output_dimensionality: EMBEDDING_DIMENSIONS,
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        const values = json.embedding?.values ?? json.embeddings?.[0]?.values;
        if (Array.isArray(values) && values.length === EMBEDDING_DIMENSIONS) {
          markGeminiKeySuccess(candidate).catch(() => {});
          return values;
        }
        console.warn(`[gemini-embedding] Unexpected response shape or dimension count:`, JSON.stringify(json).slice(0, 300));
        return null;
      }

      const errorMsg = json.error?.message || `HTTP ${res.status}`;
      console.warn(`[gemini-embedding] Key "${candidate.label}" failed (${res.status}): ${errorMsg}`);

      if (res.status === 429 || res.status === 503) {
        markGeminiKey429(candidate).catch(() => {});
        continue; // try next key
      }
      if (res.status === 401 || res.status === 403) {
        markGeminiKeyInvalid(candidate).catch(() => {});
        continue;
      }
      // 400 or other — not retriable with a different key, same request would fail again.
      return null;
    } catch (err: any) {
      console.warn(`[gemini-embedding] Exception with key "${candidate.label}":`, err.message || err);
      continue;
    }
  }

  console.warn("[gemini-embedding] All Gemini keys exhausted.");
  return null;
}
