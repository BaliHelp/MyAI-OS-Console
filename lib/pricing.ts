// Shared provider pricing estimates (USD per 1,000,000 tokens), used by OverviewTab's cost
// cards. This mirrors the flat-rate model OverviewTab has always used (single blended rate per
// provider, not input/output split) — kept separate from CostsTab.tsx's own input/output-split
// PROVIDER_COSTS table, which is a different, more detailed cost model with its own color
// palette for that tab's charts.
export const PROVIDER_COST_PER_MILLION_TOKENS: Record<string, number> = {
  gemini: 0.075,
  gpt: 0.15,
  claude: 3.00,
  grok: 2.0,
  deepseek: 0.14,
};

const DEFAULT_COST_PER_MILLION_TOKENS = 1.0;

export function estimateCostUsd(provider: string, tokens: number): number {
  const rate = PROVIDER_COST_PER_MILLION_TOKENS[provider] ?? DEFAULT_COST_PER_MILLION_TOKENS;
  return (tokens / 1_000_000) * rate;
}
