import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hashApiKey } from "@/lib/crypto";
import { IMAGE_PROVIDER_REGISTRY, DEFAULT_IMAGE_MODEL_BY_PROVIDER } from "@/lib/image-adapters";

// Image generation — a jalur paralel dari /v1/chat/completions (bukan menumpangi endpoint itu):
// gateway ini murni text-in/text-out di jalur chat, jadi output gambar dapat endpoint sendiri,
// bergaya OpenAI Images API. Gated oleh scope 'gemini_image' yang terpisah dari scope 'gemini'
// teks — sama seperti kimi_k3/deepseek_top terpisah dari provider induknya (lihat
// lib/provider-adapters/index.ts) — supaya grant akses & tracking biaya image-gen tidak otomatis
// nempel ke siapa saja yang sudah punya akses Gemini teks.

// Self-documenting GET — same reasoning as the GET added to /api/v1/chat/completions/route.ts.
export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/v1/images/generations",
    description: "Kirim `prompt` untuk generate gambar. Auth: header 'Authorization: Bearer <api-key>'.",
    body: { prompt: "string, wajib", provider: "opsional, default 'gemini'", model: "opsional, default model termurah provider itu" },
    scope_requirement: "API key butuh provider_scope '<provider>_image' (mis. 'gemini_image') — terpisah dari scope teks provider yang sama.",
    related_endpoints: {
      models_list: "GET https://console.myai.nexus/api/v1/models — cari model dengan recommended_for berisi 'image_generation'",
      models_human_readable: "https://console.myai.nexus/models",
      chat_completions: "POST https://console.myai.nexus/api/v1/chat/completions",
    },
  });
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    // 1. Authenticate API Key — pola sama persis dengan chat/completions/route.ts
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Bearer token in Authorization header is required" }, { status: 401 });
    }

    const gatewayKey = authHeader.substring(7).trim();
    if (!gatewayKey) {
      return NextResponse.json({ error: "API key token is empty" }, { status: 401 });
    }

    const keyHash = hashApiKey(gatewayKey);

    const { data: keyData, error: keyError } = await supabaseAdmin
      .from("gw_api_keys")
      .select("id, client_app_id, provider_scope, rate_limit_per_day, status, gw_client_apps(name, slug)")
      .eq("key_hash", keyHash)
      .eq("status", "active")
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
    }

    const appInfo = keyData.gw_client_apps as any;
    const appName = appInfo?.name || "Client App";

    // 2. Provider + scope gating
    const body = await req.json().catch(() => ({}));
    const provider = typeof body.provider === "string" && body.provider.trim() ? body.provider.trim() : "gemini";
    const imageProviderScope = `${provider}_image`;

    if (!IMAGE_PROVIDER_REGISTRY[provider]) {
      return NextResponse.json(
        { error: `Unknown image provider '${provider}'. Currently available: ${Object.keys(IMAGE_PROVIDER_REGISTRY).join(", ")}.` },
        { status: 400 }
      );
    }

    if (!keyData.provider_scope || !keyData.provider_scope.includes(imageProviderScope)) {
      return NextResponse.json(
        { error: `This API key's provider_scope does not include '${imageProviderScope}' — grant it access in Settings -> API Keys.` },
        { status: 403 }
      );
    }

    // 3. Rate limit (daily, same policy as chat/completions)
    if (keyData.rate_limit_per_day) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count, error: countError } = await supabaseAdmin
        .from("gw_usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("api_key_id", keyData.id)
        .gte("created_at", startOfDay.toISOString());

      if (!countError && count !== null && count >= keyData.rate_limit_per_day) {
        return NextResponse.json(
          { error: `Rate limit harian tercapai. Maksimum ${keyData.rate_limit_per_day} panggilan per hari.` },
          { status: 429 }
        );
      }
    }

    // 4. Parse prompt
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "'prompt' (string) is required" }, { status: 400 });
    }
    const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_IMAGE_MODEL_BY_PROVIDER[provider];

    // 5. Generate — the adapter manages its own key pool internally (same pool the text
    // provider uses; see lib/image-adapters/gemini-image.ts), so no gw_provider_keys lookup is
    // needed here.
    const startTime = Date.now();
    const adapter = IMAGE_PROVIDER_REGISTRY[provider];
    const result = await adapter.call("", prompt, { model_name: model });

    if (!result.success) {
      return NextResponse.json({ error: result.errorMsg || "Image generation failed" }, { status: result.status || 500 });
    }

    const latencyMs = Date.now() - startTime;

    // 6. Log usage
    await supabaseAdmin.from("gw_usage_logs").insert({
      api_key_id: keyData.id,
      app_name: appName,
      provider,
      task_type: "image_generation",
      tokens_used: 0,
      latency_ms: latencyMs,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
    });

    await supabaseAdmin.from("gw_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);

    return NextResponse.json({
      created: Math.floor(Date.now() / 1000),
      data: [{ b64_json: result.imageBase64, mime_type: result.mimeType }],
    });
  } catch (err: any) {
    console.error("[gateway] /v1/images/generations exception:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
