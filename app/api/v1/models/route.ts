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

  // Low/Medium/Top tier variants (2026-08-26, see lib/provider-adapters/index.ts) — same display
  // name as their parent provider, exactly like deepseek_reasoning/deepseek_top above; the
  // `model` field is what actually distinguishes the tier to a caller.
  gemini_medium: "Gemini",
  gemini_top: "Gemini",
  gemini_flash_3_7: "Gemini",
  gemini_flash_3_5: "Gemini",
  deepseek_v4_flash: "DeepSeek",
  deepseek_v4_pro: "DeepSeek",
  qwen_low: "Qwen",
  qwen_medium: "Qwen",
  kimi_k2_5: "Moonshot Kimi",
  claude_low: "Claude",
  claude_top: "Claude",
  gpt_medium: "GPT",
  gpt_top: "GPT",
  grok_low: "Grok",
  grok_medium: "Grok",
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
  /** How much internal "thinking"/reasoning this exact model does before answering — a fact
   * about the model itself (thinking always-on, toggleable, or absent), not a persona. */
  reasoning_level: "high" | "medium" | "low" | "none";
  /** Short, curated use-case tags — filterable/sortable by callers, spec_label below renders
   * them into the human-readable string. */
  recommended_for: string[];
}
const MODEL_DETAILS: Record<string, ModelDetail> = {
  "claude-sonnet-4-5": {
    description: "Anthropic's flagship Sonnet model — optimized for agentic workflows, coding, and multi-step tool orchestration. State-of-the-art on coding benchmarks (SWE-bench Verified).",
    context_window: "1M tokens in, 64K tokens out",
    pricing_per_million_tokens: "$3 input / $15 output",
    reasoning_level: "medium",
    recommended_for: ["coding", "agentic", "tool_use"],
  },
  "gpt-4o-mini": {
    description: "OpenAI's fast, affordable multimodal model for focused tasks — classification, extraction, translation, structured output.",
    context_window: "128K tokens in, 16K tokens out",
    pricing_per_million_tokens: "$0.15 input / $0.60 output",
    notes: "The only provider this gateway currently has real tool-calling (function calling) support for — see the tools-lock in chat/completions routing.",
    reasoning_level: "low",
    recommended_for: ["text_only", "tool_calling", "high_volume_cheap"],
  },
  "gemini-3.5-flash-lite": {
    description: "Google's low-latency, cost-effective multimodal model for high-throughput agentic workflows, document processing, and classification. Accepts text, image, speech, and video input.",
    context_window: "1M tokens in, 64K tokens out",
    pricing_per_million_tokens: "$0.30 input / $2.50 output",
    reasoning_level: "low",
    recommended_for: ["text_only", "vision_input", "high_volume_cheap"],
  },
  "grok-4.5": {
    description: "xAI's model with configurable internal reasoning effort (low/medium/high) applied before answering. Accepts text, images, and PDF files as input.",
    context_window: "500K tokens (pricing doubles beyond 200K)",
    pricing_per_million_tokens: "$2.00 input / $6.00 output (below 200K context)",
    reasoning_level: "high",
    recommended_for: ["reasoning"],
  },
  "deepseek-chat": {
    description: "General-purpose (non-reasoning) DeepSeek chat model.",
    notes: "Legacy model ID — DeepSeek's current official pricing/docs page (checked 2026-08-24) no longer lists 'deepseek-chat', only deepseek-v4-flash/deepseek-v4-pro/deepseek-v4-flash-vision-exp. The alias is still live and functional as verified in this gateway, but treat it as best-effort, not guaranteed long-term — migrating to the v4 model IDs is on the radar.",
    reasoning_level: "low",
    recommended_for: ["text_only", "high_volume_cheap"],
  },
  "deepseek-reasoner": {
    description: "Reasoning-specialized DeepSeek model — spends part of its token budget on internal chain-of-thought (a separate reasoning_content field) before emitting the final answer.",
    notes: "Same legacy-ID caveat as deepseek-chat (see above). This gateway raises max_tokens to 8000 by default for this model specifically, and treats an empty answer at the token ceiling as a retriable failure rather than a false success — see lib/provider-adapters/deepseek.ts.",
    reasoning_level: "high",
    recommended_for: ["reasoning"],
  },
  "kimi-k3": {
    description: "Moonshot AI's flagship model — 2.8T total parameters, launched 2026-07-16. This is a reasoning model: thinking mode is permanently on (cannot be disabled), depth controlled via reasoning_effort (low/high/max, default max). Streaming responses separate the thinking trace (reasoning_content) from the final answer (content).",
    context_window: "1M tokens",
    pricing_per_million_tokens: "$3 input / $15 output ($0.30/M on cache hits)",
    notes: "This gateway calls it at the default reasoning_effort (max) — no gateway parameter to lower it yet. See also deepseek-reasoner above for the same reasoning_content-vs-content split pattern.",
    reasoning_level: "high",
    recommended_for: ["reasoning"],
  },
  "kimi-k2.6": {
    description: "Moonshot AI's value-tier chat model — cheaper than K3, general-purpose, supports both thinking and non-thinking modes (toggleable, unlike K3's always-on reasoning).",
    pricing_per_million_tokens: "$0.95 input / $4.00 output",
    notes: "Corrected 2026-08-26 — previously described here as \"not a reasoning model\"; Moonshot's own docs (platform.kimi.ai) confirm K2.6 supports a thinking-mode toggle.",
    reasoning_level: "medium",
    recommended_for: ["reasoning", "text_only"],
  },
  "qwen3.8-max": {
    description: "Alibaba's flagship Qwen model — 2.4T total parameters (~95B active, Sparse Mixture-of-Experts), released 2026-08-03. Accepts text, image, and video input. Hybrid reasoning model: thinking mode is toggleable per-request (enable_thinking) with a thinking_budget cap on reasoning tokens, unlike Kimi K3's always-on reasoning.",
    context_window: "up to 1M tokens in (991K max), 131K tokens out",
    notes: "This gateway does not currently set enable_thinking explicitly, so behavior follows Alibaba's default for this model rather than a gateway-chosen setting.",
    reasoning_level: "medium",
    recommended_for: ["reasoning", "vision_input"],
  },
  "qwen/qwen-2.5-72b-instruct": {
    description: "Qwen 2.5 72B Instruct, accessed via OpenRouter (a third-party model aggregator) rather than a direct Alibaba connection — kept as a fallback option, not this gateway's primary route to Qwen.",
    reasoning_level: "low",
    recommended_for: ["text_only", "fallback"],
  },

  // ── Low/Medium/Top tier additions (2026-08-26) — additive only, see lib/provider-adapters/
  // index.ts for the identity->model wiring. Pricing/specs re-verified live against each
  // vendor's own docs on 2026-08-25/26.
  "kimi-k2.5": {
    description: "Moonshot AI's cheapest current multimodal chat model — text, image, and video input, thinking and non-thinking modes, dialogue and agent tasks.",
    context_window: "256K tokens",
    pricing_per_million_tokens: "$0.60 input (cache miss) / $3.00 output ($0.10/M on cache hits)",
    reasoning_level: "medium",
    recommended_for: ["reasoning", "text_only", "vision_input", "high_volume_cheap"],
  },
  "deepseek-v4-flash": {
    description: "DeepSeek's current official Flash model (V4-Flash-0731) — 1M context, supports both thinking (default) and non-thinking modes.",
    context_window: "1M tokens in, up to 384K tokens out",
    pricing_per_million_tokens: "$0.44 input (cache miss, peak) / $1.32 output (peak) — roughly 2x cheaper off-peak (01:00-04:00 & 06:00-10:00 UTC, Mon-Fri)",
    reasoning_level: "medium",
    recommended_for: ["reasoning", "text_only"],
  },
  "deepseek-v4-pro": {
    description: "DeepSeek's current official Pro model (V4-Pro-0813) — larger MoE flagship, same feature set as V4-Flash (JSON output, tool calls, 1M context) at a higher price/quality point.",
    context_window: "1M tokens in, up to 384K tokens out",
    pricing_per_million_tokens: "$1.32 input (cache miss, peak) / $3.96 output (peak) — roughly 2x cheaper off-peak",
    reasoning_level: "high",
    recommended_for: ["reasoning"],
  },
  "qwen3.5-flash": {
    description: "Qwen's cheapest current native vision-language Flash model.",
    context_window: "1M tokens in, 65.5K tokens out",
    pricing_per_million_tokens: "$0.10 input / $0.40 output",
    reasoning_level: "low",
    recommended_for: ["text_only", "vision_input", "high_volume_cheap"],
  },
  "qwen3.6-flash": {
    description: "Qwen's native vision-language Flash model, one generation newer than 3.5-Flash.",
    context_window: "1M tokens in, 65.5K tokens out",
    pricing_per_million_tokens: "$0.25-1.00 input / $1.50-4.00 output",
    reasoning_level: "medium",
    recommended_for: ["text_only", "vision_input"],
  },
  "claude-haiku-4-5-20251001": {
    description: "Anthropic's fastest model with near-frontier intelligence — the cheapest current Claude tier.",
    context_window: "200K tokens in, 64K tokens out",
    pricing_per_million_tokens: "$1 input / $5 output",
    notes: "Supports extended thinking, but it is not the default effort mode for this model (unlike Opus/Sonnet/Fable, which default to adaptive-high).",
    reasoning_level: "low",
    recommended_for: ["text_only", "vision_input", "tool_use", "high_volume_cheap"],
  },
  "claude-opus-5": {
    description: "Anthropic's top-tier model for complex agentic coding and enterprise work, adaptive thinking with default effort 'high'.",
    context_window: "1M tokens in, 128K tokens out",
    pricing_per_million_tokens: "$5 input / $25 output",
    reasoning_level: "high",
    recommended_for: ["reasoning", "coding", "agentic"],
  },
  "gpt-4.1": {
    description: "OpenAI's mid-tier GPT-4.1 model — general-purpose, multimodal.",
    pricing_per_million_tokens: "$2.00 input / $8.00 output",
    reasoning_level: "medium",
    recommended_for: ["text_only", "vision_input"],
  },
  "gpt-5.1": {
    description: "OpenAI's unified reasoning-capable flagship — reasoning effort is a request parameter rather than a separate o-series model line, so it uses the same Chat Completions request shape as every other GPT model this gateway calls.",
    pricing_per_million_tokens: "$1.25 input / $10.00 output",
    notes: "This gateway's tools-mode still pins the actual model to gpt-4o regardless of tier (see lib/provider-adapters/gpt.ts) — the tier distinction here only applies to non-tools calls.",
    reasoning_level: "high",
    recommended_for: ["reasoning", "tool_calling"],
  },
  "grok-build-0.1": {
    description: "xAI's cheapest current Grok model.",
    context_window: "256K tokens (pricing doubles beyond 200K)",
    pricing_per_million_tokens: "$1.00 input / $2.00 output (below 200K context)",
    reasoning_level: "low",
    recommended_for: ["text_only", "high_volume_cheap"],
  },
  "grok-4.3": {
    description: "xAI's mid-tier Grok model — cheaper than Grok 4.5, larger context window.",
    context_window: "1M tokens (pricing doubles beyond 200K)",
    pricing_per_million_tokens: "$1.25 input / $2.50 output (below 200K context)",
    reasoning_level: "medium",
    recommended_for: ["text_only", "vision_input"],
  },
  "gemini-3.6-flash": {
    description: "Google's mid-tier Flash model, built for complex coding and agentic workflows.",
    pricing_per_million_tokens: "$0.75 input / $3.75 output (promotional pricing through 2026-12-31; $1.50/$7.50 after)",
    notes: "gemini-2.5-flash (this tier's original pick) 404s live as of 2026-08-26 — \"no longer available to new users\", confirmed by real API test, not just docs. Swapped to Google's own named replacement.",
    reasoning_level: "medium",
    recommended_for: ["text_only", "vision_input"],
  },
  "gemini-3.1-pro-preview": {
    description: "Google's top-tier Gemini model — advanced reasoning and complex problem-solving.",
    pricing_per_million_tokens: "$2.00 input / $12.00 output (≤200K context; $4.00/$18.00 beyond)",
    reasoning_level: "high",
    recommended_for: ["reasoning", "coding"],
  },
  "gemini-3.7-flash": {
    description: "Google's newest-generation mid-tier Flash model, same price point as 3.6 Flash.",
    pricing_per_million_tokens: "$0.75 input / $3.75 output (promotional pricing through 2026-12-31; $1.50/$7.50 after)",
    reasoning_level: "medium",
    recommended_for: ["text_only", "vision_input"],
  },
  "gemini-3.5-flash": {
    description: "Google's Flash model one generation before 3.6/3.7 — priced higher than both despite being older, not a cost-effective pick.",
    pricing_per_million_tokens: "$1.50 input / $9.00 output",
    reasoning_level: "medium",
    recommended_for: ["text_only", "vision_input"],
  },
  // ── Image generation, cheapest to most expensive ────────────────────────────────────────────
  // All 4 share the same shared Gemini key pool (see lib/image-adapters/gemini-image.ts) — none
  // of these go through gw_provider_keys, so a caller reaches any of them by passing `model` in
  // the POST /v1/images/generations body (defaults to the cheapest, gemini-3.1-flash-lite-image).
  "gemini-3.1-flash-lite-image": {
    description: "Google's cheapest current dedicated image-generation model — text-to-image, served via this gateway's separate POST /v1/images/generations endpoint (not /v1/chat/completions).",
    pricing_per_million_tokens: "$0.0336 per 1K-resolution image",
    notes: "Requires provider_scope 'gemini_image' — a separate grant from Gemini text access. Default model for POST /v1/images/generations. See lib/image-adapters/gemini-image.ts.",
    reasoning_level: "none",
    recommended_for: ["image_generation", "cheapest_option"],
  },
  "gemini-2.5-flash-image": {
    description: "Google's previous-generation image model (\"Nano Banana\") — legacy but still live, second-cheapest image option.",
    pricing_per_million_tokens: "$0.039 per image (up to 1024x1024px; $0.0195 on Batch API)",
    notes: "Requires provider_scope 'gemini_image'. Pass `\"model\": \"gemini-2.5-flash-image\"` in the POST /v1/images/generations body to use this instead of the cheaper default.",
    reasoning_level: "none",
    recommended_for: ["image_generation"],
  },
  "gemini-3.1-flash-image": {
    description: "Google's current general-purpose image model (\"Nano Banana 2\") — more versatile/higher quality than the Lite variant, priced per resolution.",
    pricing_per_million_tokens: "$0.067 per image at 1K, $0.101 at 2K, $0.151 at 4K (50% lower on Batch API)",
    notes: "Requires provider_scope 'gemini_image'. Pass `\"model\": \"gemini-3.1-flash-image\"` in the POST /v1/images/generations body to use this instead of the cheaper default.",
    reasoning_level: "none",
    recommended_for: ["image_generation"],
  },
  "gemini-3-pro-image": {
    description: "Google's premium image model (\"Nano Banana Pro\") — highest quality, most expensive image option.",
    pricing_per_million_tokens: "$0.134 per image at 1K/2K, $0.24 at 4K",
    notes: "Requires provider_scope 'gemini_image'. Pass `\"model\": \"gemini-3-pro-image\"` in the POST /v1/images/generations body to use this instead of the cheaper default.",
    reasoning_level: "none",
    recommended_for: ["image_generation", "premium_quality"],
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
// Callers frequently only see the auto-routed model a field picks for them and don't realize
// they can ask for a specific one — this documents the escape hatch that already exists in
// app/api/v1/chat/completions/route.ts (the `model`/`provider` override), inline in the same
// response that lists what's available to pick from. Structured (not just prose) so a caller's
// own tooling can read it, plus a human-readable `summary`.
const MODEL_SELECTION_GUIDE = {
  summary:
    "Website/aplikasi Anda BEBAS memilih model AI spesifik dari daftar `models` di bawah — tidak " +
    "wajib pakai auto-routing berbasis complexity (bagian `tiers`). Cukup kirim field `model` " +
    "(atau `provider` untuk granularity lebih kasar) di body POST /api/v1/chat/completions.",
  fields: {
    model: "String model persis dari `models[].model` di bawah (mis. \"claude-opus-5\") — pilihan paling presisi, langsung ke tier itu.",
    provider: "String provider dari `models[].provider` (mis. \"gpt\") — dapat model manapun yang aktif di provider itu, tidak presisi ke tier tertentu.",
  },
  requirement:
    "API key Anda harus punya provider_scope yang mengizinkan provider/tier tersebut (di-grant admin lewat dashboard Settings -> API Keys). " +
    "Kalau belum diizinkan, request akan ditolak dengan error 400 yang jelas menyebutkan scope apa yang kurang.",
  example: {
    curl:
      "curl -X POST https://console.myai.nexus/api/v1/chat/completions " +
      "-H \"Authorization: Bearer <api-key>\" -H \"Content-Type: application/json\" " +
      "-d '{\"model\": \"claude-opus-5\", \"prompt\": \"Halo\"}'",
  },
  fallback_behavior:
    "Kalau `model`/`provider` TIDAK dikirim, request jatuh ke auto-routing normal (lihat `tiers` di bawah) — behavior lama tetap sama persis, tidak berubah.",
};

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
  const TOOLS_CAPABLE_PROVIDERS = new Set(["gpt", "gpt_medium", "gpt_top"]);

  // ── Top-level flat summary: "what's live" ──────────────────────────────
  const seen = new Set<string>();
  const models: Array<{
    name: string; provider: string; model: string;
    description?: string; context_window?: string; pricing_per_million_tokens?: string;
    supports_vision: boolean; supports_tools: boolean; notes?: string;
    reasoning_level: string; recommended_for: string[]; spec_label: string;
  }> = [];
  for (const [provider, candidates] of candidatesByProvider) {
    const publicProvider = PUBLIC_PROVIDER_NAME[provider] || provider;
    for (const c of candidates) {
      const dedupeKey = `${publicProvider}::${c.model}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const detail = MODEL_DETAILS[c.model];
      const reasoningLevel = detail?.reasoning_level ?? "none";
      const recommendedFor = detail?.recommended_for ?? [];
      const reasoningLabel = reasoningLevel === "none" ? "None" : reasoningLevel[0].toUpperCase() + reasoningLevel.slice(1);
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
        reasoning_level: reasoningLevel,
        recommended_for: recommendedFor,
        spec_label: recommendedFor.length > 0
          ? `${c.name} (${reasoningLabel}) — ${recommendedFor.join(", ")}`
          : `${c.name} (${reasoningLabel})`,
      });
    }
  }

  // ── Synthetic Gemini Image Generator entries ─────────────────────────────
  // None of these 4 go through gw_provider_keys — they all reuse the same shared Gemini key pool
  // as the 'gemini' text provider (see lib/image-adapters/gemini-image.ts), so they never appear
  // in candidatesByProvider above. Surface them here, but only when Gemini actually has a live
  // key — same "only show what's really usable right now" philosophy as the rest of this
  // endpoint — served via POST /v1/images/generations (pass `model` to pick one; defaults to the
  // cheapest), not /v1/chat/completions. Listed cheapest-first so callers scanning for a budget
  // option find it immediately.
  const IMAGE_MODELS_CHEAPEST_FIRST = [
    "gemini-3.1-flash-lite-image",
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
  ];
  if ((candidatesByProvider.get("gemini") || []).length > 0) {
    for (const imageModel of IMAGE_MODELS_CHEAPEST_FIRST) {
      const detail = MODEL_DETAILS[imageModel];
      const recommendedFor = detail?.recommended_for ?? [];
      models.push({
        name: "Gemini",
        provider: "gemini",
        model: imageModel,
        description: detail?.description,
        pricing_per_million_tokens: detail?.pricing_per_million_tokens,
        supports_vision: false,
        supports_tools: false,
        notes: detail?.notes,
        reasoning_level: "none",
        recommended_for: recommendedFor,
        spec_label: `${imageModel} (None) — ${recommendedFor.join(", ")}`,
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
      model_selection_guide: MODEL_SELECTION_GUIDE,
      related_endpoints: {
        chat_completions: "POST https://console.myai.nexus/api/v1/chat/completions",
        image_generation: "POST https://console.myai.nexus/api/v1/images/generations — lihat model dengan recommended_for berisi 'image_generation' di bawah",
        human_readable: "https://console.myai.nexus/models — versi tabel yang bisa dibaca manusia dari response ini",
      },
      // Explicit pointer, on top of `cheapest_option` in the matching model's `recommended_for`
      // below — the user's own priority was "harga murah wajib di-marking, apalagi image
      // generate" (cheap pricing must be marked, especially for image generation), so this is
      // surfaced as its own top-level field rather than requiring a caller to scan/filter `models`.
      cheapest_image_generation_model: (candidatesByProvider.get("gemini") || []).length > 0
        ? { provider: "gemini", model: "gemini-3.1-flash-lite-image", pricing: "$0.0336 per 1K-resolution image", endpoint: "POST /api/v1/images/generations" }
        : null,
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
