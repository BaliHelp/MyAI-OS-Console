import type { ProviderAdapter, FileData } from "./types";
import { supabaseAdmin } from "@/lib/supabase";
import { parseOpenAiSse } from "./sse-utils";

export const GPT_DEFAULT_MODEL = "gpt-4o-mini";

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
      const hasTools = Array.isArray(options.tools) && options.tools.length > 0;

      let requestBody: Record<string, unknown>;

      if (hasTools) {
        // Tool-calling mode: forward the caller's full conversation verbatim (preserving prior
        // assistant tool_calls and role:"tool" results) instead of flattening to a single prompt
        // string, so the caller can run a real OpenAI-style tool loop. System messages from the
        // caller are dropped — the gateway's own systemPrompt (field spec + persona + any
        // honored caller `system` field) is the single source of truth for the system turn.
        const forwardedMessages = (options.messages || []).filter((m: any) => m?.role !== "system");

        // Callers doing tool-calling are expected to send `messages`, not a bare `prompt` — but
        // fall back to `prompt` rather than sending OpenAI a conversation with no user turn at
        // all if one was omitted.
        if (forwardedMessages.length === 0 && prompt) {
          forwardedMessages.push({ role: "user", content: prompt });
        }

        // An uploaded image still must not be silently dropped just because `tools` is present —
        // attach it to the last message (as OpenAI's multipart content shape) rather than
        // ignoring it, consistent with the gateway's vision-routing guarantee.
        if (fileData && forwardedMessages.length > 0) {
          const last = forwardedMessages[forwardedMessages.length - 1];
          if (typeof last.content === "string") {
            forwardedMessages[forwardedMessages.length - 1] = {
              ...last,
              content: [
                { type: "text", text: last.content },
                { type: "image_url", image_url: { url: `data:${fileData.mimeType};base64,${fileData.base64Data}` } },
              ],
            };
          }
        }

        requestBody = {
          // Pinned regardless of the field/key's configured model — tool-calling reliability
          // requirement, not a cost-driven default like the non-tools path below.
          model: "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }, ...forwardedMessages],
          tools: options.tools,
          tool_choice: "auto",
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 2000,
        };
      } else {
        let contentArray: any[] = [{ type: "text", text: prompt }];
        if (fileData) {
          contentArray.push({
            type: "image_url",
            image_url: { url: `data:${fileData.mimeType};base64,${fileData.base64Data}` },
          });
        }

        requestBody = {
          model: options.model_name || GPT_DEFAULT_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: contentArray },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 2000,
          // Never combined with tools by the gateway (route.ts falls back to buffered JSON when
          // both are requested), so this branch is the only place `stream` needs handling.
          ...(options.stream ? { stream: true, stream_options: { include_usage: true } } : {}),
        };
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        // Streaming or not, OpenAI returns a single JSON error object on failure — never an
        // SSE body — so this parse is safe regardless of which branch built the request.
        const resJson = await res.json().catch(() => ({}));
        const errorMsg = resJson.error?.message || "OpenAI API error";
        console.warn(`[gateway] GPT key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);
        if (res.status === 400) return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: 400 };
        if (res.status === 401 || res.status === 403) await autoDisableKey(selectedKeyId, selectedKeyLabel);
        return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg, status: res.status };
      }

      if (options.stream && !hasTools && res.body) {
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
      const aiResponseText = resJson.choices?.[0]?.message?.content || "";
      const toolCalls = resJson.choices?.[0]?.message?.tool_calls;
      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;
      return {
        success: true,
        aiResponseText,
        promptTokens,
        completionTokens,
        errorMsg: "",
        status: 200,
        ...(Array.isArray(toolCalls) && toolCalls.length > 0 ? { toolCalls } : {}),
      };
    } catch (err: any) {
      console.error(`[gateway] Exception calling GPT (${selectedKeyLabel}):`, err);
      return { success: false, aiResponseText: "", promptTokens: 0, completionTokens: 0, errorMsg: err.message || "Network error", status: 500 };
    }
  },
};
