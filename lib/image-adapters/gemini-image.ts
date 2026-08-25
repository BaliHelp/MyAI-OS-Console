import type { ImageAdapter, AttemptImageResult } from "./types";
import {
  getAvailableGeminiKeys,
  markGeminiKeySuccess,
  markGeminiKey429,
  markGeminiKeyInvalid,
  type GeminiKeyCandidate,
} from "@/lib/gemini-key-pool";

// ── Gemini image-generation cascade ──────────────────────────────────────────
// Reuses the exact same Gemini API key pool as lib/provider-adapters/gemini.ts (text) — Google
// does not scope a key to specific models, so no separate key/gw_provider_keys row is needed
// for image generation. Primary is the cheapest current Gemini image model ($0.0336/image,
// confirmed live against ai.google.dev on 2026-08-25); fallback is the pricier, more versatile
// sibling in case the lite variant has an availability hiccup — same reasoning as the
// PRIMARY/FALLBACK pair in gemini.ts.
export const GEMINI_IMAGE_PRIMARY_MODEL  = "gemini-3.1-flash-lite-image";
export const GEMINI_IMAGE_FALLBACK_MODEL = "gemini-3.1-flash-image";

async function callGeminiImageApi(
  apiKey: string,
  prompt: string,
  models: string[]
): Promise<{ ok: boolean; status: number; json: any }> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    // "TEXT" must be included alongside "IMAGE" — Gemini's image-gen API rejects/ignores an
    // IMAGE-only modalities list (confirmed against ai.google.dev's own REST example).
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  };

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
    if (i < models.length - 1) {
      console.warn(`[gemini-image] ${model} → ${res.status} (${json.error?.message}). Retrying with ${models[i + 1]}...`);
      continue;
    }
    return { ok: false, status: res.status, json };
  }
  return { ok: false, status: 500, json: { error: { message: "All Gemini image models in cascade failed" } } };
}

export const geminiImageAdapter: ImageAdapter = {
  async call(
    providerApiKey: string,
    prompt: string,
    options: { model_name?: string },
    selectedKeyId?: string | null,
    selectedKeyLabel = ""
  ): Promise<AttemptImageResult> {
    const modelsToTry = options.model_name
      ? Array.from(new Set([options.model_name, GEMINI_IMAGE_FALLBACK_MODEL]))
      : [GEMINI_IMAGE_PRIMARY_MODEL, GEMINI_IMAGE_FALLBACK_MODEL];

    let candidates: GeminiKeyCandidate[] = [];
    try {
      candidates = await getAvailableGeminiKeys();
    } catch (err) {
      console.warn("[gemini-image] Failed to load key pool, falling back to single key:", err);
    }

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
      const idx = candidates.findIndex(k => k.apiKey === hintKey);
      if (idx > 0) {
        const [hint] = candidates.splice(idx, 1);
        candidates.unshift(hint);
      }
    }

    if (candidates.length === 0) {
      return {
        success: false,
        imageBase64: "",
        mimeType: "",
        errorMsg: "No Gemini API keys configured. Add keys via Console → Provider Keys or GEMINI_API_KEY_1 env var.",
        status: 503,
      };
    }

    let lastErrorMsg = "No keys attempted";
    let lastStatus = 503;

    for (const candidate of candidates) {
      try {
        const { ok, status, json } = await callGeminiImageApi(candidate.apiKey, prompt, modelsToTry);

        if (ok) {
          const parts: any[] = json.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find((p) => p?.inlineData?.data);

          if (!imagePart) {
            // 200 OK but no image part — usually a safety block that returned text-only. Treat
            // as a fatal (not retriable) failure for this key/model rather than silently
            // succeeding with an empty image.
            const textPart = parts.find((p) => typeof p?.text === "string");
            const errorMsg = textPart?.text
              ? `Gemini returned text instead of an image (likely safety block): ${textPart.text.slice(0, 200)}`
              : "Gemini response had no image part";
            console.warn(`[gemini-image-pool] Key "${candidate.label}": ${errorMsg}`);
            return { success: false, imageBase64: "", mimeType: "", errorMsg, status: 400 };
          }

          markGeminiKeySuccess(candidate).catch(() => {});
          console.log(`[gemini-image-pool] ✅ Success with key "${candidate.label}"`);
          return {
            success: true,
            imageBase64: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType || "image/png",
            errorMsg: "",
            status: 200,
          };
        }

        const errorMsg = json.error?.message || `Gemini API error ${status}`;
        console.warn(`[gemini-image-pool] Key "${candidate.label}" failed (${status}): ${errorMsg}`);

        if (status === 429 || status === 503) {
          markGeminiKey429(candidate).catch(() => {});
          lastErrorMsg = errorMsg;
          lastStatus = 429;
          continue;
        }

        if (status === 401 || status === 403) {
          markGeminiKeyInvalid(candidate).catch(() => {});
          lastErrorMsg = errorMsg;
          lastStatus = 401;
          continue;
        }

        if (status === 400) {
          return { success: false, imageBase64: "", mimeType: "", errorMsg, status: 400 };
        }

        lastErrorMsg = errorMsg;
        lastStatus = status;
        continue;
      } catch (err: any) {
        console.error(`[gemini-image-pool] Exception with key "${candidate.label}":`, err);
        lastErrorMsg = err.message || "Network error";
        lastStatus = 500;
        continue;
      }
    }

    console.error(`[gemini-image-pool] ❌ All ${candidates.length} Gemini key(s) failed. Last: ${lastErrorMsg}`);
    return {
      success: false,
      imageBase64: "",
      mimeType: "",
      errorMsg: `All ${candidates.length} Gemini key(s) exhausted. Last error: ${lastErrorMsg}`,
      status: lastStatus,
    };
  },
};
