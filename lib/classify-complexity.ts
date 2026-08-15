/**
 * Pure, server-side prompt-length classifier for complexity-based reasoning tiering.
 *
 * Classifies a request as 'light' | 'reasoning' | 'top' purely from the character length
 * of the resolved user prompt (before RAG/persona/system-prompt injection — this classifies
 * the question, not the context around it). Server-side and automatic on purpose: no client
 * app needs to compute or send a hint for this to work, so every current and future field
 * gets it "for free" the moment its gw_field_pool_assignments rows are tagged with the
 * matching complexity buckets (see app/api/v1/chat/completions/route.ts).
 *
 * Thresholds are first-guess defaults with no real traffic data behind them yet — kept as
 * named constants specifically so they're a one-line tune later, not something that needs
 * to be "right" on day one.
 */

export const COMPLEXITY_THRESHOLDS = {
  light: 150, // prompt.length <= 150        -> 'light'
  reasoning: 800, // 150 < prompt.length <= 800  -> 'reasoning'; above -> 'top'
} as const;

export type Complexity = "light" | "reasoning" | "top";

export function classifyComplexity(promptText: string): Complexity {
  const len = (promptText || "").trim().length;
  if (len <= COMPLEXITY_THRESHOLDS.light) return "light";
  if (len <= COMPLEXITY_THRESHOLDS.reasoning) return "reasoning";
  return "top";
}
