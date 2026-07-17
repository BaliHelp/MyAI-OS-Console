import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptKey } from "@/lib/crypto";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";

  // ── Rate limit: 20 req/hour per IP ────────────────────────────────────
  const rateCheck = await checkRateLimit(ip, RATE_LIMITS.GEMINI);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Rate limit tercapai. Coba lagi setelah ${rateCheck.resetAt.toLocaleTimeString("id-ID")}.` },
      { status: 429 }
    );
  }

  const { prompt } = await req.json();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  try {
    // ── Fetch context from Supabase ──────────────────────────────────────
    let docsContext = "";
    let profileContent = "";

    if (supabaseAdmin) {
      const [{ data: docs }, { data: profile }, { data: apps }] = await Promise.all([
        supabaseAdmin.from("gw_knowledge_documents").select("title, content, client_app_id"),
        supabaseAdmin.from("gw_business_profile").select("content").limit(1).single(),
        supabaseAdmin.from("gw_client_apps").select("id, name"),
      ]);

      profileContent = profile?.content ?? "";
      const appNameById: Record<string, string> = {};
      apps?.forEach((a: { id: string; name: string }) => { appNameById[a.id] = a.name; });

      docsContext = (docs ?? [])
        .map((d: { title: string; content: string; client_app_id: string | null }) => {
          const scope = d.client_app_id
            ? `Scope: Product ${appNameById[d.client_app_id] ?? "Unknown"}`
            : "Scope: Global/Shared";
          return `Document: "${d.title}" (${scope})\nContent: ${d.content}`;
        })
        .join("\n\n");
    }

    const systemPrompt = `You are "MyAI OS Gateway Helper" — a secure AI assistant for the admin console of the MyBusiness ecosystem.

Business Profile:
${profileContent}

Knowledge Base:
${docsContext || "No knowledge documents configured yet."}

Answer the admin's question clearly, accurately, and professionally. Default to Bahasa Indonesia. Support English if requested. If the answer is not in the knowledge base, say so clearly.`;

    // ── Get API key: try provider_keys table first (LRU rotation), then env fallback ──
    let apiKey = process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY || "";

    if (supabaseAdmin) {
      const { data: providerKeys } = await supabaseAdmin
        .from("gw_provider_keys")
        .select("id, key_encrypted, usage_count, last_used_at")
        .eq("provider", "gemini")
        .eq("status", "active")
        .order("last_used_at", { ascending: true, nullsFirst: true })
        .order("usage_count", { ascending: true })
        .limit(1);

      if (providerKeys && providerKeys.length > 0) {
        const selected = providerKeys[0];
        try {
          apiKey = decryptKey(selected.key_encrypted);
          // Update LRU stats
          await supabaseAdmin
            .from("gw_provider_keys")
            .update({
              usage_count: (selected.usage_count ?? 0) + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq("id", selected.id);
        } catch (err) {
          console.error("[gemini] Failed to decrypt provider key, using env fallback:", err);
        }
      }
    }

    // ── Simulated response if no API key ─────────────────────────────────
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("[gemini] GEMINI_API_KEY not configured. Returning simulated response.");
      let response = "Halo! Gateway Helper di sini (mode simulasi — GEMINI_API_KEY belum dikonfigurasi).\n\n";
      if (prompt.toLowerCase().includes("visa") || prompt.toLowerCase().includes("refund")) {
        response += "Berdasarkan dokumen knowledge base, pengembalian dana 100% hanya disetujui jika ada kesalahan teknis dari tim internal.";
      } else if (prompt.toLowerCase().includes("api") || prompt.toLowerCase().includes("tropic")) {
        response += "Integrasi Tropic Tech menggunakan HTTPS ke `api.tropictech.com/v1/` dengan rate limit 120 req/menit per IP.";
      } else {
        response += `Ekosistem MyBusiness mengelola 5 aplikasi yang semuanya terhubung ke MyAI OS Gateway. Pertanyaan Anda: "${prompt}"`;
      }
      return NextResponse.json({ text: response });
    }

    // ── Real Gemini API call ──────────────────────────────────────────────
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { systemInstruction: systemPrompt, temperature: 0.7 },
    });

    return NextResponse.json({ text: result.text });
  } catch (err: unknown) {
    console.error("[gemini] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `AI Error: ${message}` }, { status: 500 });
  }
}
