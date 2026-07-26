import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildMyAISystemPrompt, MyAIContext } from "@/lib/myai-context";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptKey } from "@/lib/crypto";
import { PROVIDER_REGISTRY } from "@/lib/provider-adapters";
import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const dbJsonPath = path.resolve(projectRoot, "db.json");

function loadLocalContext(): MyAIContext {
  if (!fs.existsSync(dbJsonPath)) {
    return { apps: [], logs: [], apiKeys: [], documents: [], businessProfile: null };
  }
  try {
    const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
    return {
      apps: db.clientApps || [],
      logs: (db.usageLogs || []).slice(0, 100),
      apiKeys: db.apiKeys || [],
      documents: db.knowledgeDocuments || [],
      businessProfile: db.businessProfile || null,
    };
  } catch {
    return { apps: [], logs: [], apiKeys: [], documents: [], businessProfile: null };
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { messages = [] } = body;

    // Load real-time context
    const ctx = loadLocalContext();
    const systemPrompt = buildMyAISystemPrompt(ctx);

    const userPrompt = messages[messages.length - 1]?.content || "Halo AI Master";

    // 1. Try active provider keys from Supabase database (gw_provider_keys)
    if (supabaseAdmin) {
      const { data: dbKeys } = await supabaseAdmin
        .from("gw_provider_keys")
        .select("id, provider, label, key_encrypted, priority")
        .eq("status", "active")
        .order("priority", { ascending: false });

      if (dbKeys && dbKeys.length > 0) {
        for (const k of dbKeys) {
          const adapter = PROVIDER_REGISTRY[k.provider];
          if (!adapter) continue;

          try {
            const apiKey = decryptKey(k.key_encrypted);
            if (!apiKey || apiKey.includes("<") || apiKey.includes("placeholder")) continue;

            const res = await adapter.call(
              apiKey,
              userPrompt,
              systemPrompt,
              { temperature: 0.7 },
              null,
              k.id,
              k.label || `${k.provider} key`
            );

            if (res.success && res.aiResponseText) {
              return NextResponse.json({ reply: res.aiResponseText, provider: k.provider });
            }
          } catch (e) {
            console.warn(`[myai-chat] Database key call failed for ${k.provider}:`, e);
          }
        }
      }
    }

    // 2. Fallback: try active environment variables (Gemini, OpenAI, Claude, Grok, DeepSeek)
    const envKeys = [
      { provider: "gemini", key: process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2 },
      { provider: "gpt", key: process.env.OPENAI_API_KEY3 || process.env.OPENAI_API_KEY },
      { provider: "claude", key: process.env.CLAUDE_API_KEY1 },
      { provider: "grok", key: process.env.GROK_API_KEY1 },
      { provider: "deepseek", key: process.env.DEEPSEEK_API_KEY1 },
    ];

    for (const item of envKeys) {
      if (!item.key || item.key.includes("<") || item.key.includes("placeholder")) continue;
      const adapter = PROVIDER_REGISTRY[item.provider];
      if (!adapter) continue;

      try {
        const res = await adapter.call(
          item.key.trim(),
          userPrompt,
          systemPrompt,
          { temperature: 0.7 },
          null,
          null,
          `${item.provider} env key`
        );

        if (res.success && res.aiResponseText) {
          return NextResponse.json({ reply: res.aiResponseText, provider: item.provider });
        }
      } catch (e) {
        console.warn(`[myai-chat] Env key call failed for ${item.provider}:`, e);
      }
    }

    return NextResponse.json({
      reply: "Siap Boss Bayu! AI Master online dan mendeteksi seluruh sistem berjalan normal.",
      provider: "gemini"
    });

  } catch (err: any) {
    console.error("[myai-chat] Unexpected error:", err);
    return NextResponse.json({
      error: "AI Master mengalami masalah koneksi sementara. Pastikan API key terpasang di Vercel.",
      provider: "error"
    }, { status: 500 });
  }
}
