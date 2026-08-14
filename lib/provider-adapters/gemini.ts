import type { ProviderAdapter, FileData, AttemptCallResult } from "./types";
import {
  getAvailableGeminiKeys,
  markGeminiKeySuccess,
  markGeminiKey429,
  markGeminiKeyInvalid,
  type GeminiKeyCandidate,
} from "@/lib/gemini-key-pool";

// ── Gemini model cascade ─────────────────────────────────────────────────────
// Default primary/fallback when a key has no model_name override configured.
// The previous pair (gemini-2.5-flash-lite / gemini-2.5-flash) 404s with "no
// longer available to new users" — confirmed live against Google's API.
export const GEMINI_PRIMARY_MODEL  = "gemini-3.5-flash-lite";
export const GEMINI_FALLBACK_MODEL = "gemini-flash-lite-latest";

async function callGeminiApi(
  apiKey: string,
  body: object,
  models: string[]
): Promise<{ ok: boolean; status: number; json: any }> {
  // Try each model in order; fall through to the next on failure.
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
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
    // Not the last model in the cascade — fall through and try the next one.
    if (i < models.length - 1) {
      console.warn(`[gemini] ${model} → ${res.status} (${json.error?.message}). Retrying with ${models[i + 1]}...`);
      continue;
    }
    // Last model in the cascade also failed — return the error.
    return { ok: false, status: res.status, json };
  }
  return { ok: false, status: 500, json: { error: { message: "All Gemini models in cascade failed" } } };
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

    // An explicit per-key override is tried first but still falls back to the safe default on
    // failure, so a caller who mistakenly configures a dead model doesn't lose Gemini entirely —
    // the connection test (lib/test-provider-connection.ts) is what surfaces a dead override.
    const modelsToTry = options.model_name
      ? Array.from(new Set([options.model_name, GEMINI_FALLBACK_MODEL]))
      : [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL];

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
        const { ok, status, json } = await callGeminiApi(candidate.apiKey, requestBody, modelsToTry);

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
