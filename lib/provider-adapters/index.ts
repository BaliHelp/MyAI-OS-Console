/**
 * Central Provider Adapter Registry
 *
 * To add a new provider:
 *   1. Create lib/provider-adapters/<name>.ts implementing ProviderAdapter
 *   2. Import and add a single entry to PROVIDER_REGISTRY below
 *   No changes needed in the routing loop or UI provider dropdowns.
 */

import type { ProviderAdapter } from "./types";
import { geminiAdapter, GEMINI_PRIMARY_MODEL } from "./gemini";
import { gptAdapter, GPT_DEFAULT_MODEL } from "./gpt";
import { claudeAdapter, CLAUDE_DEFAULT_MODEL } from "./claude";
import { grokAdapter, GROK_DEFAULT_MODEL } from "./grok";
import { deepseekAdapter, DEEPSEEK_DEFAULT_MODEL } from "./deepseek";
import { customOpenaiAdapter } from "./custom-openai-compatible";

export const PROVIDER_REGISTRY: Record<string, ProviderAdapter> = {
  gemini: geminiAdapter,
  gpt: gptAdapter,
  claude: claudeAdapter,
  grok: grokAdapter,
  deepseek: deepseekAdapter,
  others: customOpenaiAdapter,
  custom_openai: customOpenaiAdapter,
};

/**
 * Single source of truth for each provider's default chat-completion model — the model actually
 * used when a gw_provider_keys row has no model_name override. Kept here (not re-typed at each
 * call site) so the dashboard/connection-test can display and probe the real default instead of
 * drifting out of sync with what the adapters actually request.
 */
export const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  gemini: GEMINI_PRIMARY_MODEL,
  gpt: GPT_DEFAULT_MODEL,
  claude: CLAUDE_DEFAULT_MODEL,
  grok: GROK_DEFAULT_MODEL,
  deepseek: DEEPSEEK_DEFAULT_MODEL,
};

/**
 * Returns the ordered list of supported provider names for use in UI dropdowns.
 * Adding a new provider to PROVIDER_REGISTRY automatically exposes it in the UI.
 */
export function getSupportedProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

export type { ProviderAdapter, FileData, AttemptCallResult, ToolDefinition, ToolCall } from "./types";
