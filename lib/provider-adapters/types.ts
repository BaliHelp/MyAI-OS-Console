import { supabaseAdmin } from "@/lib/supabase";

// ── Shared Types ────────────────────────────────────────────────────────────
export interface FileData {
  mimeType: string;
  base64Data: string;
}

/** OpenAI-compatible tool/function definition, passed through verbatim. */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/** OpenAI-compatible tool call the model asked the caller to execute. */
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** One normalized increment of a streamed response. */
export interface StreamChunk {
  /** Incremental text produced this chunk. Omitted on the final chunk if there's no trailing text. */
  delta?: string;
  /** Present only on the final chunk, once the provider has reported final usage. */
  promptTokens?: number;
  completionTokens?: number;
}

export interface AttemptCallResult {
  success: boolean;
  aiResponseText: string;
  promptTokens: number;
  completionTokens: number;
  errorMsg: string;
  status: number;
  /** Present when the model chose to call a tool instead of (or alongside) answering in text. */
  toolCalls?: ToolCall[];
  /**
   * Present when `options.stream` was true and the call succeeded (status 200) — an async
   * generator of normalized delta chunks the caller can consume to relay real streaming output
   * to its own client. When present, aiResponseText/promptTokens/completionTokens are NOT yet
   * populated (still "" / 0); the caller must fully consume the generator and accumulate them
   * itself. Adapters without real incremental streaming support may still set this by wrapping
   * their normal buffered result in a single-chunk generator — callers should never need to know
   * which case they're in.
   */
  streamChunks?: AsyncGenerator<StreamChunk>;
}

export interface ProviderAdapter {
  /** Whether this provider can accept image/file attachments */
  supportsVision: boolean;
  /** Build the HTTP request and return the AI response */
  call(
    providerApiKey: string,
    prompt: string,
    systemPrompt: string,
    options: {
      temperature?: number;
      max_tokens?: number;
      model_name?: string;
      base_url?: string | null;
      /**
       * OpenAI-shaped tools array. Only honored by the gpt adapter — the gateway locks routing
       * to gpt whenever tools are present (see route.ts), so no other adapter needs to read this.
       */
      tools?: ToolDefinition[];
      /**
       * Full caller-supplied conversation (all turns, including prior assistant tool_calls and
       * role:"tool" results), forwarded verbatim when tools are present instead of the flattened
       * single `prompt` string. Ignored unless `tools` is also set.
       */
      messages?: Array<Record<string, unknown>>;
      /**
       * When true, the caller wants incremental output — the adapter should populate
       * AttemptCallResult.streamChunks instead of (or in addition to, immaterially) the buffered
       * aiResponseText. Never combined with `tools` by the gateway (route.ts falls back to
       * buffered JSON when both are requested), so adapters don't need to handle that case.
       */
      stream?: boolean;
    },
    fileData?: FileData | null,
    selectedKeyId?: string | null,
    selectedKeyLabel?: string
  ): Promise<AttemptCallResult>;
}
