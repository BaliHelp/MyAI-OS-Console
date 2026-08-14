import type { ProviderAdapter, FileData, AttemptCallResult } from "./types";
import {
  getAvailableGeminiKeys,
  markGeminiKeySuccess,
  markGeminiKey429,
  markGeminiKeyInvalid,
  type GeminiKeyCandidate,
} from "@/lib/gemini-key-pool";

// ── Gemini model cascade ─────────────────────────────────────────────────────
// Primary model is tried first; if it returns non-200, fallback is used.
// The previous pair (gemini-2.5-flash-lite / gemini-2.5-flash) now 404s with
// "no longer available to new users" for every key in this pool — confirmed live
// against Google's API, not a regional/quota issue. gemini-flash-lite-latest is a
// Google-maintained alias that tracks whatever the current recommended lite model
// is, so the fallback shouldn't go stale the same way again.
const PRIMARY_MODEL   = "gemini-3.5-flash-lite";
const FALLBACK_MODEL  = "gemini-flash-lite-latest";

async function callGeminiApi(
  apiKey: string,
  body: object
): Promise<{ ok: boolean; status: number; json: any }> {
  // Try primary model first
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: 200, json };
    // If primary fails for non-quota reasons, fall through to next model
    if (model === PRIMARY_MODEL && !res.ok) {
      console.warn(`[gemini] ${PRIMARY_MODEL} → ${res.status} (${json.error?.message}). Retrying with ${FALLBACK_MODEL}...`);
      continue;
    }
    // Fallback also failed — return the error
    return { ok: false, status: res.status, json };
  }
  return { ok: false, status: 500, json: { error: { message: "Both Gemini models failed" } } };
}

export const geminiAdapter: ProviderAdapter = {
  supportsVision: true,

  /**
   * Smart multi-key Gemini adapter.
   *
   * The `providerApiKey` argument (from the outer routing loop) is used as a
   * HINT / first candidate. The adapter then queries the full Gemini key pool
   * and tries every available key in LRU order. This means a single gateway
   * request can internally exhaust and rotate through all Gemini keys before
   * giving up — no tier-skip needed for transient quota errors.
   */
  async call(
    providerApiKey: string,
    prompt: string,
    systemPrompt: string,
    options: { temperature?: number; max_tokens?: number; model_name?: string },
    fileData?: FileData | null,
    selectedKeyId?: string | null,
    selectedKeyLabel = ""
  ): Promise<AttemptCallResult> {
    // Build the Gemini request body (reused across all key attempts)
    const parts: any[] = [{ text: prompt }];
    if (fileData) {
      parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.base64Data } });
    }
    const requestBody = {
      contents: [{ parts }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.max_tokens ?? 2000,
      },
    };

    // ── Fetch the full live key pool ─────────────────────────────────────────
    let candidates: GeminiKeyCandidate[] = [];
    try {
      candidates = await getAvailableGeminiKeys();
    } catch (err) {
      console.warn("[gemini] Failed to load key pool, falling back to single key:", err);
    }

    // Ensure the caller-supplied key is in the list (as first candidate)
    // This covers the env-var fallback path where the key may not be in the DB.
    const hintKey = providerApiKey?.trim();
    if (hintKey && !candidates.find(k => k.apiKey === hintKey)) {
      candidates.unshift({
        id: selectedKeyId ?? null,
        apiKey: hintKey,
        label: selectedKeyLabel || "Gemini Primary",
        usageCount: 0,
        lastUsedAt: null,
        cooldownUntil: null,
        consecutive429: 0,
      });
    } else if (hintKey) {
      // Move the hint key to the front so it's tried first
      const idx = candidates.findIndex(k => k.apiKey === hintKey);
      if (idx > 0) {
        const [hint] = candidates.splice(idx, 1);
        candidates.unshift(hint);
      }
    }

    if (candidates.length === 0) {
      return {
        success: false,
        aiResponseText: "",
        promptTokens: 0,
        completionTokens: 0,
        errorMsg: "No Gemini API keys configured. Add keys via Console → Provider Keys or GEMINI_API_KEY_1 env var.",
        status: 503,
      };
    }

    let lastErrorMsg = "No keys attempted";
    let lastStatus = 503;

    // ── Try each key in order ────────────────────────────────────────────────
    for (const candidate of candidates) {
      try {
        const { ok, status, json } = await callGeminiApi(candidate.apiKey, requestBody);

        if (ok) {
          const aiResponseText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const promptTokens   = Math.ceil(prompt.length / 4) + Math.ceil(systemPrompt.length / 4);
          const completionTokens = Math.ceil(aiResponseText.length / 4);

          // Update stats async (do not await — don't block response)
          markGeminiKeySuccess(candidate).catch(() => {});

          console.log(`[gemini-pool] ✅ Success with key "${candidate.label}"`);
          return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
        }

        // ── Handle errors ──────────────────────────────────────────────────
        const errorMsg = json.error?.message || `Gemini API error ${status}`;
        console.warn(`[gemini-pool] Key "${candidate.label}" failed (${status}): ${errorMsg}`);

        if (status === 429 || status === 503) {
          // Quota / rate-limit — put this key in cooldown and try next
          markGeminiKey429(candidate).catch(() => {});
          lastErrorMsg = errorMsg;
          lastStatus   = 429;
          continue; // ← try next key immediately
        }

        if (status === 401 || status === 403) {
          // Invalid key — disable permanently and try next
          markGeminiKeyInvalid(candidate).catch(() => {});
          lastErrorMsg = errorMsg;
          lastStatus   = 401;
          continue;
        }

        if (status === 400) {
          // True bad request (invalid prompt/schema) — fatal, don't retry
          return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: 400 };
        }

        lastErrorMsg = errorMsg;
        lastStatus   = status;
        // For other errors, still try next key (network blip etc.)
        continue;

      } catch (err: any) {
        console.error(`[gemini-pool] Exception with key "${candidate.label}":`, err);
        lastErrorMsg = err.message || "Network error";
        lastStatus   = 500;
        continue;
      }
    }

    // All keys exhausted
    console.error(`[gemini-pool] ❌ All ${candidates.length} Gemini key(s) failed. Last: ${lastErrorMsg}`);
    return {
      success: false,
      aiResponseText: "",
      promptTokens: 0,
      completionTokens: 0,
      errorMsg: `All ${candidates.length} Gemini key(s) exhausted. Last error: ${lastErrorMsg}`,
      status: lastStatus,
    };
  },
};
