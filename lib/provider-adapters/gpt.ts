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

export const gptAdapter: ProviderAdapter = {
  supportsVision: true,

  async call(providerApiKey, prompt, systemPrompt, options, fileData, selectedKeyId, selectedKeyLabel = "") {
    try {
      let contentArray: any[] = [{ type: "text", text: prompt }];
      if (fileData) {
        contentArray.push({
          type: "image_url",
          image_url: { url: `data:${fileData.mimeType};base64,${fileData.base64Data}` },
        });
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerApiKey}`,
        },
        body: JSON.stringify({
          model: options.model_name || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: contentArray },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 2000,
        }),
      });

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = resJson.error?.message || "OpenAI API error";
        console.warn(`[gateway] GPT key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);
        if (res.status === 400) return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: 400 };
        if (res.status === 401 || res.status === 403) await autoDisableKey(selectedKeyId, selectedKeyLabel);
        return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: res.status };
      }

      const aiResponseText = resJson.choices?.[0]?.message?.content || "";
      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;
      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    } catch (err: any) {
      console.error(`[gateway] Exception calling GPT (${selectedKeyLabel}):`, err);
      return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg: err.message || "Network error", status: 500 };
    }
  },
};
