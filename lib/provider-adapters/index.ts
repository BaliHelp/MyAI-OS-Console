/**
 * Central Provider Adapter Registry
 *
 * To add a new provider:
 *   1. Create lib/provider-adapters/<name>.ts implementing ProviderAdapter
 *   2. Import and add a single entry to PROVIDER_REGISTRY below
 *   No changes needed in the routing loop or UI provider dropdowns.
 */

import type { ProviderAdapter } from "./types";
import { geminiAdapter } from "./gemini";
import { gptAdapter } from "./gpt";
import { claudeAdapter } from "./claude";
import { grokAdapter } from "./grok";
import { deepseekAdapter } from "./deepseek";

export const PROVIDER_REGISTRY: Record<string, ProviderAdapter> = {
  gemini: geminiAdapter,
  gpt: gptAdapter,
  claude: claudeAdapter,
  grok: grokAdapter,
  deepseek: deepseekAdapter,
};

/**
 * Returns the ordered list of supported provider names for use in UI dropdowns.
 * Adding a new provider to PROVIDER_REGISTRY automatically exposes it in the UI.
 */
export function getSupportedProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

export type { ProviderAdapter, FileData, AttemptCallResult } from "./types";
