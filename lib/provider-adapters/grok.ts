import type { ProviderAdapter } from "./types";
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

export const grokAdapter: ProviderAdapter = {
  supportsVision: false,

  async call(providerApiKey, prompt, systemPrompt, options, _fileData, selectedKeyId, selectedKeyLabel = "") {
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerApiKey}`,
        },
        body: JSON.stringify({
          model: options.model_name || "grok-2",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: options.temperature ?? 0.7,
        }),
      });

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = resJson.error?.message || "Grok API error";
        console.warn(`[gateway] Grok key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);
        if (res.status === 400) return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: 400 };
        if (res.status === 401 || res.status === 403) await autoDisableKey(selectedKeyId, selectedKeyLabel);
        return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: res.status };
      }

      const aiResponseText = resJson.choices?.[0]?.message?.content || "";
      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;
      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    } catch (err: any) {
      console.error(`[gateway] Exception calling Grok (${selectedKeyLabel}):`, err);
      return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg: err.message || "Network error", status: 500 };
    }
  },
};
