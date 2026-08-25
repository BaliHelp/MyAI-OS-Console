// Shared provider display name + color mapping, used by OverviewTab and its overview/*
// subcomponents (ranking card, network graph, activity feed) so the same provider always
// renders with the same name/color instead of each place reimplementing its own mapping.
export const PROVIDER_COLOR: Record<string, string> = {
  claude: "#E879F9",
  gpt: "var(--success)",
  gemini: "var(--accent)",
  grok: "#FBBF24",
  deepseek: "#38BDF8",
};

export const DEFAULT_PROVIDER_COLOR = "#818CF8";

export function getProviderColor(provider: string): string {
  return PROVIDER_COLOR[provider] ?? DEFAULT_PROVIDER_COLOR;
}

export function getProviderDisplayName(provider: string): string {
  switch (provider) {
    case "gpt": return "GPT (OpenAI)";
    case "gemini": return "Gemini (Google)";
    case "claude": return "Claude (Anthropic)";
    case "grok": return "Grok (xAI)";
    case "deepseek": return "DeepSeek";
    case "kimi": return "Moonshot Kimi";
    case "qwen": return "Qwen";
    default: return provider.toUpperCase();
  }
}
