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
import { deepseekAdapter, DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_REASONER_MODEL } from "./deepseek";
import { customOpenaiAdapter } from "./custom-openai-compatible";

export const PROVIDER_REGISTRY: Record<string, ProviderAdapter> = {
  gemini: geminiAdapter,
  gpt: gptAdapter,
  claude: claudeAdapter,
  grok: grokAdapter,
  deepseek: deepseekAdapter,
  // Same adapter as `deepseek` — only the model_name differs (set per gw_provider_keys row).
  // Kept as distinct registry/provider names (not just a model_name override on the plain
  // `deepseek` provider) so complexity-based reasoning tiering's key-candidate pooling, which
  // groups strictly by provider string, never mixes these into the light-tier `deepseek` pool.
  // See lib/classify-complexity.ts and the pool assignment logic in
  // app/api/v1/chat/completions/route.ts.
  deepseek_reasoning: deepseekAdapter,
  deepseek_top: deepseekAdapter,
  // Same OpenAI-compatible adapter, driven purely by each key's base_url/model_name — kept as
  // distinct provider identities (not one shared "others" bucket) so provider_scope grants and
  // field pool tiers can target exactly one of them. A shared "others" made it impossible to
  // grant a client access to Kimi without also granting OpenRouter, and vice versa.
  kimi: customOpenaiAdapter,
  openrouter: customOpenaiAdapter,
  qwen: customOpenaiAdapter,
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
  deepseek_reasoning: DEEPSEEK_REASONER_MODEL,
  deepseek_top: DEEPSEEK_REASONER_MODEL,
};

/**
 * Returns the ordered list of supported provider names for use in UI dropdowns.
 * Adding a new provider to PROVIDER_REGISTRY automatically exposes it in the UI.
 */
export function getSupportedProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

export type { ProviderAdapter, FileData, AttemptCallResult, ToolDefinition, ToolCall, StreamChunk } from "./types";
