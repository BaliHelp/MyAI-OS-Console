import type { ProviderAdapter } from "./types";
import { supabaseAdmin } from "@/lib/supabase";
import { parseOpenAiSse } from "./sse-utils";

export const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
export const DEEPSEEK_REASONER_MODEL = "deepseek-reasoner";

async function autoDisableKey(selectedKeyId: string | null | undefined, selectedKeyLabel: string) {
  if (selectedKeyId && supabaseAdmin) {
    console.warn(`[gateway] Auto-disabling key in DB: ${selectedKeyLabel}`);
    await supabaseAdmin
      .from("gw_provider_keys")
      .update({ status: "disabled" })
      .eq("id", selectedKeyId);
  }
}

export const deepseekAdapter: ProviderAdapter = {
  supportsVision: false,

  async call(providerApiKey, prompt, systemPrompt, options, _fileData, selectedKeyId, selectedKeyLabel = "") {
    try {
      const model = options.model_name || DEEPSEEK_DEFAULT_MODEL;
      const isReasoner = model === DEEPSEEK_REASONER_MODEL;

      // deepseek-reasoner spends part of max_tokens on its internal reasoning_content before it
      // ever emits the final answer's `content`. At the old flat default (2000) a non-trivial
      // prompt could burn the whole budget on reasoning and finish with finish_reason:"length"
      // and an EMPTY content string — a silent 200 with completion_tokens:2000 and nothing to
      // show for it. Reasoner gets a much larger budget so hitting the ceiling before any answer
      // text is emitted becomes rare; deepseek-chat (no separate reasoning phase) is unaffected.
      const defaultMaxTokens = isReasoner ? 8000 : 2000;

      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? defaultMaxTokens,
          ...(options.stream ? { stream: true, stream_options: { include_usage: true } } : {}),
        }),
      });

      if (!res.ok) {
        const resJson = await res.json().catch(() => ({}));
        const errorMsg = resJson.error?.message || "Deepseek API error";
        console.warn(`[gateway] Deepseek key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);
        if (res.status === 400) return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: 400 };
        if (res.status === 401 || res.status === 403) await autoDisableKey(selectedKeyId, selectedKeyLabel);
        return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: res.status };
      }

      if (options.stream && res.body) {
        return {
          success: true,
          aiResponseText: "",
          promptTokens: 0,
          completionTokens: 0,
          errorMsg: "",
          status: 200,
          streamChunks: parseOpenAiSse(res.body),
        };
      }

      const resJson = await res.json();
      const choice = resJson.choices?.[0];
      const aiResponseText = choice?.message?.content || "";
      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;

      // Ran out of max_tokens before any answer text came out (all budget went to
      // reasoning_content, or the answer itself got cut mid-stream to nothing usable). Treat as
      // retriable rather than a false "success" with an empty result — the tier loop above
      // falls through to the next candidate/tier on a non-400 failure, same as a 429/5xx would,
      // instead of silently handing the caller an empty string.
      if (!aiResponseText && choice?.finish_reason === "length") {
        const errorMsg = `Deepseek (${model}) exhausted max_tokens (${options.max_tokens ?? defaultMaxTokens}) before producing any answer text (finish_reason: length, completion_tokens: ${completionTokens}).`;
        console.warn(`[gateway] ${errorMsg} Key: ${selectedKeyLabel}.`);
        return { success: false, aiResponseText: "", promptTokens, completionTokens, errorMsg, status: 503 };
      }

      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    } catch (err: any) {
      console.error(`[gateway] Exception calling Deepseek (${selectedKeyLabel}):`, err);
      return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg: err.message || "Network error", status: 500 };
    }
  },
};
