import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_MODEL_BY_PROVIDER, PUBLIC_PROVIDER_NAME, PROVIDER_REGISTRY } from "@/lib/provider-adapters";
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
  qwen: "Qwen",
  // 'openrouter' deliberately has NO fixed entry here (unlike kimi/qwen above): OpenRouter is a
  // genuine third-party aggregator proxying many different vendors' models, not one consistent
  // product — a bare "OpenRouter" name told a caller nothing about which underlying model they'd
  // actually get. Falls through to the key's own label below (e.g. "OpenRouter (Qwen 2.5 72B)"),
  // same reasoning as the "others"/custom_openai fallback further down.
};

// PUBLIC_PROVIDER_NAME (imported above) is used only for the top-level `models` summary — it
// collapses deepseek_reasoning/deepseek_top/kimi_k3 back to their public parent provider so the
// flat list dedupes to "DeepSeek offers these N models" instead of listing the same model under
// 3 internal provider names. The `tiers` section below keeps them distinct on purpose, since
// that's exactly the routing detail it exists to show.

// Per-model detail, keyed by the exact `model` string. Facts (context window, pricing, release
// date) are sourced from each vendor's own docs/pricing pages as of 2026-08-24, not invented —
// re-verify before trusting numbers here long after that date, vendors revise pricing/limits
// often. `supports_vision`/`supports_tools` are NOT duplicated here — derived below from
// PROVIDER_REGISTRY (vision) and a hardcoded tools allowlist, so they can never drift from what
// the gateway actually enforces at request time.
interface ModelDetail {
  description: string;
  context_window?: string;
  pricing_per_million_tokens?: string;
  notes?: string;
}
const MODEL_DETAILS: Record<string, ModelDetail> = {
  "claude-sonnet-4-5": {
    description: "Anthropic's flagship Sonnet model — optimized for agentic workflows, coding, and multi-step tool orchestration. State-of-the-art on coding benchmarks (SWE-bench Verified).",
    context_window: "1M tokens in, 64K tokens out",
    pricing_per_million_tokens: "$3 input / $15 output",
  },
  "gpt-4o-mini": {
    description: "OpenAI's fast, affordable multimodal model for focused tasks — classification, extraction, translation, structured output.",
    context_window: "128K tokens in, 16K tokens out",
    pricing_per_million_tokens: "$0.15 input / $0.60 output",
    notes: "The only provider this gateway currently has real tool-calling (function calling) support for — see the tools-lock in chat/completions routing.",
  },
  "gemini-3.5-flash-lite": {
    description: "Google's low-latency, cost-effective multimodal model for high-throughput agentic workflows, document processing, and classification. Accepts text, image, speech, and video input.",
    context_window: "1M tokens in, 64K tokens out",
    pricing_per_million_tokens: "$0.30 input / $2.50 output",
  },
  "grok-4.5": {
    description: "xAI's model with configurable internal reasoning effort (low/medium/high) applied before answering. Accepts text, images, and PDF files as input.",
    context_window: "500K tokens (pricing doubles beyond 200K)",
    pricing_per_million_tokens: "$2.00 input / $6.00 output (below 200K context)",
  },
  "deepseek-chat": {
    description: "General-purpose (non-reasoning) DeepSeek chat model.",
    notes: "Legacy model ID — DeepSeek's current official pricing/docs page (checked 2026-08-24) no longer lists 'deepseek-chat', only deepseek-v4-flash/deepseek-v4-pro/deepseek-v4-flash-vision-exp. The alias is still live and functional as verified in this gateway, but treat it as best-effort, not guaranteed long-term — migrating to the v4 model IDs is on the radar.",
  },
  "deepseek-reasoner": {
    description: "Reasoning-specialized DeepSeek model — spends part of its token budget on internal chain-of-thought (a separate reasoning_content field) before emitting the final answer.",
    notes: "Same legacy-ID caveat as deepseek-chat (see above). This gateway raises max_tokens to 8000 by default for this model specifically, and treats an empty answer at the token ceiling as a retriable failure rather than a false success — see lib/provider-adapters/deepseek.ts.",
  },
  "kimi-k3": {
    description: "Moonshot AI's flagship model — 2.8T total parameters, launched 2026-07-16. Strong reasoning and long-context performance.",
    context_window: "1M tokens",
    pricing_per_million_tokens: "$3 input / $15 output ($0.30/M on cache hits)",
  },
  "kimi-k2.6": {
    description: "Moonshot AI's value-tier chat model — cheaper than K3, general-purpose.",
    pricing_per_million_tokens: "$0.95 input / $4.00 output",
  },
  "qwen3.8-max": {
    description: "Alibaba's flagship Qwen model — 2.4T total parameters (~95B active, Sparse Mixture-of-Experts), released 2026-08-03. Accepts text, image, and video input.",
    context_window: "up to 1M tokens in (991K max), 131K tokens out",
  },
  "qwen/qwen-2.5-72b-instruct": {
    description: "Qwen 2.5 72B Instruct, accessed via OpenRouter (a third-party model aggregator) rather than a direct Alibaba connection — kept as a fallback option, not this gateway's primary route to Qwen.",
  },
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

  // Real tool-calling (function calling) support, as actually implemented in this gateway's
  // adapters today — not what each vendor's own API is capable of. Only gpt.ts forwards `tools`
  // to the provider and parses `tool_calls` back out; every other adapter silently ignores
  // `tools` even though several vendors (Claude, Kimi) support it natively. Single source of
  // truth so `/api/v1/models` can never claim tool support this gateway doesn't actually honor.
  const TOOLS_CAPABLE_PROVIDERS = new Set(["gpt"]);

  // ── Top-level flat summary: "what's live" ──────────────────────────────
  const seen = new Set<string>();
  const models: Array<{
    name: string; provider: string; model: string;
    description?: string; context_window?: string; pricing_per_million_tokens?: string;
    supports_vision: boolean; supports_tools: boolean; notes?: string;
  }> = [];
  for (const [provider, candidates] of candidatesByProvider) {
    const publicProvider = PUBLIC_PROVIDER_NAME[provider] || provider;
    for (const c of candidates) {
      const dedupeKey = `${publicProvider}::${c.model}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const detail = MODEL_DETAILS[c.model];
      models.push({
        name: c.name,
        provider: publicProvider,
        model: c.model,
        description: detail?.description,
        context_window: detail?.context_window,
        pricing_per_million_tokens: detail?.pricing_per_million_tokens,
        supports_vision: PROVIDER_REGISTRY[provider]?.supportsVision ?? false,
        supports_tools: TOOLS_CAPABLE_PROVIDERS.has(provider),
        notes: detail?.notes,
      });
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
