/**
 * Universal MyAI OS Client SDK
 * Lightweight helper library for external apps (MyBusiness, Kamus AI, Tropic Tech, etc.)
 * Handles gateway chat, vision/OCR, reasoning, and automatic Data Center ingestion.
 */

export interface MyAiOSClientOptions {
  apiKey: string;
  gatewayUrl?: string;
  sourceApp?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  field?: string;
  systemPrompt?: string;
  temperature?: number;
}

export class MyAiOSClient {
  private apiKey: string;
  private gatewayUrl: string;
  private sourceApp: string;

  constructor(options: MyAiOSClientOptions) {
    this.apiKey = options.apiKey;
    this.gatewayUrl = (options.gatewayUrl || "https://console.myai.nexus/api/v1/chat/completions").replace(/\/$/, "");
    this.sourceApp = options.sourceApp || "unknown-app";
  }

  /**
   * Execute chat completion via MyAI OS Gateway
   */
  async chat(messages: ChatMessage[] | string, options: ChatOptions = {}) {
    const fieldKey = options.field || "chatbot_general";
    const formattedMessages = typeof messages === "string"
      ? [{ role: "user" as const, content: messages }]
      : messages;

    const res = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        field: fieldKey,
        messages: formattedMessages,
        system: options.systemPrompt,
        temperature: options.temperature,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`MyAI OS Gateway Error (HTTP ${res.status}): ${errText}`);
    }

    const data = await res.json();

    // Fire-and-forget ingestion sync for non-OCR responses
    this.ingestData("chat_interaction", {
      field: fieldKey,
      user_message: typeof messages === "string" ? messages : messages[messages.length - 1]?.content,
      ai_response: typeof data.result === "string" ? data.result : JSON.stringify(data.result),
      provider_used: data.provider_used,
    }, {
      field_key: fieldKey,
      tags: [this.sourceApp, fieldKey, "sdk_call"],
    }).catch(() => {});

    return data;
  }

  /**
   * Direct push event to Master Data Center (/api/data-center/ingest)
   */
  async ingestData(eventType: string, payload: Record<string, any>, metadata: Record<string, any> = {}) {
    const ingestUrl = this.gatewayUrl.replace("/v1/chat/completions", "/data-center/ingest");
    try {
      const res = await fetch(ingestUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_app: this.sourceApp,
          event_type: eventType,
          data: payload,
          metadata: {
            ...metadata,
            source_app: this.sourceApp,
          },
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Factory helper for quick instantiation
 */
export function createMyAiClient(apiKey: string, sourceApp?: string) {
  return new MyAiOSClient({ apiKey, sourceApp });
}
