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
  // Kept distinct from `kimi` (not a second key row under the same provider) for the same
  // pooling-isolation reason as deepseek_reasoning/deepseek_top above: kimi_k3 is meant to sit
  // at tier 1 of the 'top' complexity bucket, while the plain `kimi` key sits at a fields'
  // final fallback tier — sharing one provider bucket would pull kimi-k3 into that fallback
  // tier too (and vice versa) whenever either is referenced.
  kimi_k3: customOpenaiAdapter,
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
 * Maps a pooling-isolation-only provider identity back to the public name a caller would
 * recognize (e.g. from GET /api/v1/models or their own explicit `model`/`provider` override).
 * deepseek_reasoning/deepseek_top/kimi_k3 exist purely so complexity-tiering's tier-pooling
 * (which groups strictly by provider string) never mixes them with their "parent" provider's
 * own tier — not a distinction external callers should need to know about. Single source of
 * truth shared by GET /api/v1/models (display) and the chat completions route (resolving an
 * explicit override back to every internal provider that can serve it).
 */
export const PUBLIC_PROVIDER_NAME: Record<string, string> = {
  deepseek_reasoning: "deepseek",
  deepseek_top: "deepseek",
  kimi_k3: "kimi",
};

/**
 * Returns the ordered list of supported provider names for use in UI dropdowns.
 * Adding a new provider to PROVIDER_REGISTRY automatically exposes it in the UI.
 */
export function getSupportedProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

export type { ProviderAdapter, FileData, AttemptCallResult, ToolDefinition, ToolCall, StreamChunk } from "./types";
