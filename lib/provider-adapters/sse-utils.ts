import type { StreamChunk } from "./types";

/**
 * Reads a raw byte stream and yields complete lines (split on \n, trailing \r stripped),
 * buffering partial lines across chunk boundaries — network delivery doesn't align with SSE
 * event boundaries, so a naive per-chunk split would corrupt multi-chunk lines.
 */
async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        yield line.replace(/\r$/, "");
      }
    }
    if (buffer) yield buffer.replace(/\r$/, "");
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parses an OpenAI-compatible chat-completions SSE stream (used by gpt, grok, deepseek, and
 * any custom-openai-compatible backend — they all emit the same `data: {...}` / `data: [DONE]`
 * shape with `choices[0].delta.content`). Requesting `stream_options.include_usage: true` (which
 * the adapters do) puts final token counts on the last content-bearing chunk before [DONE].
 */
export async function* parseOpenAiSse(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
  let promptTokens = 0;
  let completionTokens = 0;

  for await (const line of readLines(body)) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") break;
    if (!payload) continue;

    let json: any;
    try {
      json = JSON.parse(payload);
    } catch {
      continue; // malformed/partial line — skip rather than crash the whole stream
    }

    const delta: string | undefined = json.choices?.[0]?.delta?.content;
    if (json.usage) {
      promptTokens = json.usage.prompt_tokens ?? promptTokens;
      completionTokens = json.usage.completion_tokens ?? completionTokens;
    }
    if (delta) yield { delta };
  }

  yield { promptTokens, completionTokens };
}

/**
 * Parses Anthropic's Messages API SSE stream. Distinct event/data shape from OpenAI's:
 * message_start carries input_tokens, content_block_delta carries incremental text
 * (delta.type === "text_delta"), message_delta carries the final output_tokens.
 */
export async function* parseAnthropicSse(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
  let promptTokens = 0;
  let completionTokens = 0;

  for await (const line of readLines(body)) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload) continue;

    let json: any;
    try {
      json = JSON.parse(payload);
    } catch {
      continue;
    }

    if (json.type === "message_start") {
      promptTokens = json.message?.usage?.input_tokens ?? promptTokens;
    } else if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
      if (json.delta.text) yield { delta: json.delta.text };
    } else if (json.type === "message_delta") {
      completionTokens = json.usage?.output_tokens ?? completionTokens;
    } else if (json.type === "message_stop") {
      break;
    }
  }

  yield { promptTokens, completionTokens };
}

/**
 * For adapters without real incremental streaming yet (Gemini in this phase): wraps an already-
 * complete response as a single-chunk generator so callers never need to know which providers
 * truly stream token-by-token vs. deliver everything at once — the SSE contract to the end
 * client is identical either way, just not incrementally progressive for these providers.
 */
export async function* singleChunkStream(
  text: string,
  promptTokens: number,
  completionTokens: number
): AsyncGenerator<StreamChunk> {
  if (text) yield { delta: text };
  yield { promptTokens, completionTokens };
}
