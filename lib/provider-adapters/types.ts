import { supabaseAdmin } from "@/lib/supabase";

// ── Shared Types ────────────────────────────────────────────────────────────
export interface FileData {
  mimeType: string;
  base64Data: string;
}

export interface AttemptCallResult {
  success: boolean;
  aiResponseText: string;
  promptTokens: number;
  completionTokens: number;
  errorMsg: string;
  status: number;
}

export interface ProviderAdapter {
  /** Whether this provider can accept image/file attachments */
  supportsVision: boolean;
  /** Build the HTTP request and return the AI response */
  call(
    providerApiKey: string,
    prompt: string,
    systemPrompt: string,
    options: { temperature?: number; max_tokens?: number; model_name?: string },
    fileData?: FileData | null,
    selectedKeyId?: string | null,
    selectedKeyLabel?: string
  ): Promise<AttemptCallResult>;
}
