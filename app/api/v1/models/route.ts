import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_MODEL_BY_PROVIDER } from "@/lib/provider-adapters";

// Deliberately public (see PUBLIC_PATHS in proxy.ts) — meant for any client site using the
// Gateway to check which AI/provider/model combination is currently live, without needing a
// gateway API key or opening the console dashboard. Live DB read every request, so it's
// inherently always current; no cron/cache layer needed at this scale.
//
// Intentionally minimal: name, provider, model only — no usage counts, no cost data, no key
// labels or IDs. Nothing here should let a caller infer how many keys exist per provider or
// any other internal capacity detail.

const PROVIDER_DISPLAY_NAME: Record<string, string> = {
  gemini: "Gemini",
  gpt: "GPT",
  claude: "Claude",
  grok: "Grok",
  deepseek: "DeepSeek",
};

// deepseek_reasoning/deepseek_top are internal routing entries (see
// lib/provider-adapters/index.ts) that exist purely so complexity-based reasoning tiering's
// key-candidate pooling never mixes them with the plain 'deepseek' light-tier key — not a
// distinction this public, unauthenticated endpoint should expose. Normalized back to
// 'deepseek' here so they report/dedupe as the same provider a caller already sees.
const PUBLIC_PROVIDER_NAME: Record<string, string> = {
  deepseek_reasoning: "deepseek",
  deepseek_top: "deepseek",
};

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin
    .from("gw_provider_keys")
    .select("provider, label, model_name")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const models: Array<{ name: string; provider: string; model: string }> = [];

  for (const row of data || []) {
    const model = row.model_name || DEFAULT_MODEL_BY_PROVIDER[row.provider] || null;
    if (!model) continue; // no configured model and no known default (e.g. an unrecognized provider) — skip rather than report a null model

    const publicProvider = PUBLIC_PROVIDER_NAME[row.provider] || row.provider;
    const dedupeKey = `${publicProvider}::${model}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // "others"/"custom_openai" keys aren't one consistent product — use the key's own label
    // (e.g. "Moonshot Kimi", "OpenROUTER") rather than a generic "Others" name.
    const name =
      PROVIDER_DISPLAY_NAME[publicProvider] ||
      row.label ||
      publicProvider;

    models.push({ name, provider: publicProvider, model });
  }

  return NextResponse.json(models, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
