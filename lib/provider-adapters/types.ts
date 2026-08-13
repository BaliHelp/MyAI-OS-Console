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

export interface AttemptCallResult {
  success: boolean;
  aiResponseText: string;
  promptTokens: number;
  completionTokens: number;
  errorMsg: string;
  status: number;
  /** Present when the model chose to call a tool instead of (or alongside) answering in text. */
  toolCalls?: ToolCall[];
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
    },
    fileData?: FileData | null,
    selectedKeyId?: string | null,
    selectedKeyLabel?: string
  ): Promise<AttemptCallResult>;
}
