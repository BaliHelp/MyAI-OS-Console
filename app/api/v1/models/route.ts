import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_MODEL_BY_PROVIDER } from "@/lib/provider-adapters";
import { COMPLEXITY_THRESHOLDS } from "@/lib/classify-complexity";

// Deliberately public (see PUBLIC_PATHS in proxy.ts) — meant for any client site using the
// Gateway to check which AI/provider/model combination is currently live, and how our
// complexity-based reasoning tiering routes their requests, without needing a gateway API key
// or opening the console dashboard. Live DB read every request (both `models` and `tiers`), so
// it's inherently always current — adding a provider key or reordering a field's routing in the
// dashboard shows up here on the very next request, no cron/cache layer needed at this scale.
//
// `models`/`tiers` intentionally omit usage counts, cost data, and key labels/IDs — nothing
// here should let a caller infer how many keys exist per provider, only which
// provider/model they'll actually get and in what order.

const PROVIDER_DISPLAY_NAME: Record<string, string> = {
  gemini: "Gemini",
  gpt: "GPT",
  claude: "Claude",
  grok: "Grok",
  deepseek: "DeepSeek",
  // deepseek_reasoning/deepseek_top are internal routing entries (see
  // lib/provider-adapters/index.ts) that exist purely so complexity-based reasoning tiering's
  // key-candidate pooling never mixes them with the plain 'deepseek' light-tier key — display
  // name-wise they're still just "DeepSeek" to a caller (the surrounding bucket/tier position
  // already communicates which one it is).
  deepseek_reasoning: "DeepSeek",
  deepseek_top: "DeepSeek",
  // Restricted-purpose credential (Google-side blocked from the Generative Language API,
  // works only for Cloud TTS/STT — see TTS_STT_KEY_NOTICE below). Listed here under its own
  // provider so callers scanning `models` for TTS/STT availability find it by name instead of
  // the raw internal key label.
  google_tts_stt: "Google TTS/STT",
  // Previously shared one vague 'others' provider string with OpenRouter — split into
  // dedicated identities (2026-08-22) so provider_scope/pool-tier config can target exactly
  // one of them instead of granting/routing to both together.
  kimi: "Moonshot Kimi",
  openrouter: "OpenRouter",
  qwen: "Qwen",
};

// Used only for the top-level `models` summary — collapses deepseek_reasoning/deepseek_top back
// to 'deepseek' so that flat list dedupes to "DeepSeek offers these N models" instead of
// listing the same model 3x under 3 internal provider names. The `tiers` section below keeps
// them distinct on purpose, since that's exactly the routing detail it exists to show.
const PUBLIC_PROVIDER_NAME: Record<string, string> = {
  deepseek_reasoning: "deepseek",
  deepseek_top: "deepseek",
  // Same reasoning: kimi_k3 exists as its own provider purely for tier-pooling isolation (see
  // lib/provider-adapters/index.ts) — folded back into 'kimi' here so the flat list reads as
  // "Kimi offers these 2 models" instead of a 3rd near-duplicate provider entry.
  kimi_k3: "kimi",
};

const TIER_UPDATE_NOTICE =
  "Struktur tier & model bisa berubah sewaktu-waktu (siklus review internal setiap 12 jam). " +
  "Aplikasi yang memakai Gateway ini wajib fetch ulang endpoint ini minimal 2x sehari — jam 06:00 " +
  "dan 18:00 WIB — supaya routing di sisi Anda tidak stale dibanding konfigurasi live kami. " +
  "Data di response ini selalu real-time per request (bukan snapshot dari jadwal itu); jadwal " +
  "06:00/18:00 hanya rekomendasi cadence polling minimum di sisi Anda.";

// Ecosystem also holds a Google API key restricted (by Google, at the project/API level) to
// Cloud Text-to-Speech & Speech-to-Text only — it 403s on the Generative Language API on
// purpose, so it's listed under its own 'google_tts_stt' provider (not folded into 'gemini')
// and has no gw_field_pool_assignments row — no chat/reasoning/OCR field routes to it today.
// Documented here so a caller doesn't assume Gemini capacity above implies TTS/STT, and so a
// future integration (e.g. an article-to-speech feature) knows this credential exists and is
// reachable directly against Google's Cloud TTS/STT REST APIs (not through this gateway's
// chat-completions routing, which has no TTS/STT adapter yet).
const TTS_STT_KEY_NOTICE =
  "Ekosistem ini juga memiliki 1 API key Google (provider 'google_tts_stt' di atas) yang " +
  "dibatasi Google khusus untuk Cloud Text-to-Speech & Speech-to-Text saja — bukan untuk " +
  "Gemini chat/reasoning/OCR umum, dan tidak dirutekan ke field apa pun di Gateway ini. " +
  "Jangan asumsikan kapasitas Gemini di atas mencakup TTS/STT. Key ini sengaja disiapkan " +
  "untuk kebutuhan text-to-speech/speech-to-text aplikasi seperti NewsBali/NewsKotabunan " +
  "di masa depan — hubungi admin Gateway untuk akses, karena belum ada endpoint TTS/STT " +
  "khusus di Gateway ini (integrasi langsung ke Google Cloud REST API).";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const [keysRes, assignmentsRes] = await Promise.all([
    supabaseAdmin.from("gw_provider_keys").select("provider, label, model_name").eq("status", "active"),
    supabaseAdmin.from("gw_field_pool_assignments").select("field_key, provider, pool_tier, complexity"),
  ]);

  if (keysRes.error) {
    return NextResponse.json({ error: keysRes.error.message }, { status: 500 });
  }

  const keyRows = keysRes.data || [];

  // Resolve every active key to its real model once, keyed by the RAW (non-normalized) provider
  // name — the `tiers` section needs deepseek_reasoning/deepseek_top kept distinct, and a
  // provider like 'others' can legitimately resolve to several different models (Kimi,
  // OpenRouter, ...), so each provider maps to a small deduped list of {name, model} candidates
  // rather than a single value.
  const candidatesByProvider = new Map<string, Array<{ name: string; model: string }>>();
  for (const row of keyRows) {
    const model = row.model_name || DEFAULT_MODEL_BY_PROVIDER[row.provider] || null;
    if (!model) continue; // no configured model and no known default — skip rather than report null

    const name =
      PROVIDER_DISPLAY_NAME[row.provider] ||
      row.label || // "others"/"custom_openai" keys aren't one consistent product — use the key's own label
      row.provider;

    const list = candidatesByProvider.get(row.provider) || [];
    if (!list.some((c) => c.name === name && c.model === model)) {
      list.push({ name, model });
    }
    candidatesByProvider.set(row.provider, list);
  }

  // ── Top-level flat summary: "what's live" ──────────────────────────────
  const seen = new Set<string>();
  const models: Array<{ name: string; provider: string; model: string }> = [];
  for (const [provider, candidates] of candidatesByProvider) {
    const publicProvider = PUBLIC_PROVIDER_NAME[provider] || provider;
    for (const c of candidates) {
      const dedupeKey = `${publicProvider}::${c.model}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      models.push({ name: c.name, provider: publicProvider, model: c.model });
    }
  }

  // ── Per-field tier structure: "how a request gets routed" ─────────────
  // gw_field_pool_assignments has one row per (field, provider, complexity bucket), tried in
  // pool_tier order within a bucket — multiple providers can share a pool_tier (tried by key
  // priority; see the DeepSeek-first reorder migration), so this groups rows into
  // field -> complexity -> tier -> candidate list, resolving each provider to its live model(s)
  // exactly like the flat list above. A tier with no currently-active key resolves to an empty
  // candidates array rather than being silently dropped, so a caller can tell "this tier exists
  // but has nothing live right now" apart from "this tier doesn't exist."
  const tiers: Record<string, Record<string, Array<{ tier: number; candidates: Array<{ name: string; model: string }> }>>> = {};

  if (!assignmentsRes.error) {
    type Row = { field_key: string; provider: string; pool_tier: number; complexity: string };
    const byField = new Map<string, Map<string, Map<number, Row[]>>>();

    for (const row of (assignmentsRes.data || []) as Row[]) {
      const byComplexity = byField.get(row.field_key) || new Map<string, Map<number, Row[]>>();
      const byTier = byComplexity.get(row.complexity) || new Map<number, Row[]>();
      const list = byTier.get(row.pool_tier) || [];
      list.push(row);
      byTier.set(row.pool_tier, list);
      byComplexity.set(row.complexity, byTier);
      byField.set(row.field_key, byComplexity);
    }

    for (const [fieldKey, byComplexity] of byField) {
      tiers[fieldKey] = {};
      for (const [complexity, byTier] of byComplexity) {
        const sortedTiers = Array.from(byTier.keys()).sort((a, b) => a - b);
        tiers[fieldKey][complexity] = sortedTiers.map((tierNum) => {
          const rows = byTier.get(tierNum)!;
          const candidates: Array<{ name: string; model: string }> = [];
          for (const row of rows) {
            for (const c of candidatesByProvider.get(row.provider) || []) {
              if (!candidates.some((x) => x.name === c.name && x.model === c.model)) {
                candidates.push(c);
              }
            }
          }
          return { tier: tierNum, candidates };
        });
      }
    }
  }

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      tier_update_notice: TIER_UPDATE_NOTICE,
      tts_stt_key_notice: TTS_STT_KEY_NOTICE,
      complexity_classification: {
        light: `prompt length <= ${COMPLEXITY_THRESHOLDS.light} characters`,
        reasoning: `${COMPLEXITY_THRESHOLDS.light} < prompt length <= ${COMPLEXITY_THRESHOLDS.reasoning} characters`,
        top: `prompt length > ${COMPLEXITY_THRESHOLDS.reasoning} characters`,
      },
      models,
      tiers,
    },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
