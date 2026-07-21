import type { ProviderAdapter, FileData } from "./types";
import { supabaseAdmin } from "@/lib/supabase";

async function autoDisableKey(selectedKeyId: string | null | undefined, selectedKeyLabel: string) {
  if (selectedKeyId && supabaseAdmin) {
    console.warn(`[gateway] Auto-disabling key in DB: ${selectedKeyLabel}`);
    await supabaseAdmin
      .from("gw_provider_keys")
      .update({ status: "disabled" })
      .eq("id", selectedKeyId);
  }
}

export const claudeAdapter: ProviderAdapter = {
  supportsVision: true,

  async call(providerApiKey, prompt, systemPrompt, options, fileData, selectedKeyId, selectedKeyLabel = "") {
    try {
      let contentArray: any[] = [{ type: "text", text: prompt }];
      if (fileData) {
        contentArray.push({
          type: "image",
          source: { type: "base64", media_type: fileData.mimeType, data: fileData.base64Data },
        });
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": providerApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: options.model_name || "claude-3-5-sonnet-20241022",
          max_tokens: options.max_tokens ?? 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: contentArray }],
          temperature: options.temperature ?? 0.7,
        }),
      });

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = resJson.error?.message || resJson.error?.type || "Anthropic API error";
        const errorType = resJson.error?.type || "";
        console.warn(`[gateway] Claude key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);

        // ── Credit / billing errors: treat as retriable (not a fatal bad-request) ──
        // Anthropic sends HTTP 400 for credit_balance_too_low, and sometimes 529/529.
        // We re-map these to status 402 so the outer loop DOES NOT short-circuit and
        // falls through to the next tier/provider instead of returning fatal to caller.
        const CREDIT_ERROR_SIGNALS = [
          "credit_balance_too_low",
          "insufficient_quota",
          "billing_not_active",
          "payment_required",
          "overloaded_error",   // Anthropic overload — also retriable
        ];
        const isCreditOrBillingError =
          CREDIT_ERROR_SIGNALS.includes(errorType) ||
          /credit balance|insufficient.*credit|quota.*exceed|billing|payment required/i.test(errorMsg);

        if (res.status === 400 && isCreditOrBillingError) {
          // Mark key in cooldown via returned status 402 — outer loop handles cooldown write
          console.warn(`[gateway] Claude credit/billing error on key ${selectedKeyLabel} — routing to next tier.`);
          return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg: `[CREDIT] ${errorMsg}`, status: 402 };
        }

        // True 400: caller sent a bad request (invalid model, malformed content, etc.)
        // These are fatal — no point retrying with another key/tier.
        if (res.status === 400) {
          return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: 400 };
        }

        if (res.status === 401 || res.status === 403) await autoDisableKey(selectedKeyId, selectedKeyLabel);
        return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: res.status };
      }

      const aiResponseText = resJson.content?.[0]?.text || "";
      const promptTokens = resJson.usage?.input_tokens || 0;
      const completionTokens = resJson.usage?.output_tokens || 0;
      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    } catch (err: any) {
      console.error(`[gateway] Exception calling Claude (${selectedKeyLabel}):`, err);
      return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg: err.message || "Network error", status: 500 };
    }
  },
};
