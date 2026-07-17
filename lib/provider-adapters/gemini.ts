import type { ProviderAdapter, FileData, AttemptCallResult } from "./types";
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

export const geminiAdapter: ProviderAdapter = {
  supportsVision: true,

  async call(providerApiKey, prompt, systemPrompt, options, fileData, selectedKeyId, selectedKeyLabel = "") {
    try {
      const parts: any[] = [{ text: prompt }];
      if (fileData) {
        parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.base64Data } });
      }

      const body = {
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.max_tokens ?? 2000,
        },
      };

      let modelToUse = "gemini-3.1-flash-lite";
      let res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${providerApiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );

      if (!res.ok) {
        const firstErr = await res.json().catch(() => ({}));
        console.warn(`[gemini] ${modelToUse} failed: ${firstErr.error?.message}. Retrying with gemini-3.5-flash...`);
        modelToUse = "gemini-3.5-flash";
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${providerApiKey}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        );
      }

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = resJson.error?.message || "Gemini API error";
        console.warn(`[gateway] Gemini key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);
        if (res.status === 400) return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: 400 };
        if (res.status === 401 || res.status === 403) await autoDisableKey(selectedKeyId, selectedKeyLabel);
        return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: res.status };
      }

      const aiResponseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const promptTokens = Math.ceil(prompt.length / 4) + Math.ceil(systemPrompt.length / 4);
      const completionTokens = Math.ceil(aiResponseText.length / 4);
      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    } catch (err: any) {
      console.error(`[gateway] Exception calling Gemini (${selectedKeyLabel}):`, err);
      return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg: err.message || "Network error", status: 500 };
    }
  },
};
