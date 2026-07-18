import { NextRequest, NextResponse } from "next/server";
import { decryptKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // 1. Fetch key from DB
    const { data: keyData, error: fetchError } = await supabaseAdmin
      .from("gw_provider_keys")
      .select("key_encrypted, provider, base_url")
      .eq("id", id)
      .single();

    if (fetchError || !keyData) {
      return NextResponse.json({ error: fetchError?.message || "Key not found" }, { status: 404 });
    }

    // 2. Decrypt key
    let rawKey = "";
    try {
      rawKey = decryptKey(keyData.key_encrypted);
    } catch {
      return NextResponse.json({ error: "Failed to decrypt API key (mismatch master secret)" }, { status: 500 });
    }

    if (!rawKey) {
      return NextResponse.json({ error: "API key is empty" }, { status: 400 });
    }

    const provider = keyData.provider;
    let connected = false;
    let details = "";

    console.log(`[test-conn] Testing connection for provider: ${provider}, key id: ${id}`);

    // 3. Test connection based on provider
    if (provider === "gemini") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${rawKey}`);
      if (res.status === 200) {
        connected = true;
        details = "Koneksi sukses (Google AI Studio)";
      } else {
        const json = await res.json().catch(() => ({}));
        details = `Gagal: ${json.error?.message || `HTTP ${res.status}`}`;
      }
    } else if (provider === "gpt") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${rawKey}`
        }
      });
      if (res.status === 200) {
        connected = true;
        details = "Koneksi sukses (OpenAI API)";
      } else {
        const json = await res.json().catch(() => ({}));
        details = `Gagal: ${json.error?.message || `HTTP ${res.status}`}`;
      }
    } else if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": rawKey,
          "anthropic-version": "2023-06-01"
        }
      });
      if (res.status === 200) {
        connected = true;
        details = "Koneksi sukses (Anthropic API)";
      } else {
        const json = await res.json().catch(() => ({}));
        details = `Gagal: ${json.error?.message || `HTTP ${res.status}`}`;
      }
    } else if (provider === "grok") {
      const res = await fetch("https://api.x.ai/v1/models", {
        headers: {
          "Authorization": `Bearer ${rawKey}`
        }
      });
      if (res.status === 200) {
        connected = true;
        details = "Koneksi sukses (x.ai API)";
      } else {
        const json = await res.json().catch(() => ({}));
        details = `Gagal: ${json.error?.message || `HTTP ${res.status}`}`;
      }
    } else if (provider === "deepseek") {
      const res = await fetch("https://api.deepseek.com/models", {
        headers: {
          "Authorization": `Bearer ${rawKey}`
        }
      });
      if (res.status === 200) {
        connected = true;
        details = "Koneksi sukses (Deepseek API)";
      } else {
        const json = await res.json().catch(() => ({}));
        details = `Gagal: ${json.error?.message || `HTTP ${res.status}`}`;
      }
    } else if (provider === "others" || provider === "custom_openai") {
      let testUrl = (keyData as any).base_url || "https://openrouter.ai/api/v1";
      if (testUrl.endsWith("/chat/completions")) {
        testUrl = testUrl.replace("/chat/completions", "/models");
      } else {
        if (testUrl.endsWith("/")) {
          testUrl += "models";
        } else {
          testUrl += "/models";
        }
      }
      const res = await fetch(testUrl, {
        headers: { 
          "Authorization": `Bearer ${rawKey}`,
          "HTTP-Referer": "https://console.myai.bali.technology",
          "X-Title": "MyAI OS Console Gateway"
        }
      });
      if (res.status === 200) {
        connected = true;
        details = "Koneksi sukses (Custom OpenAI API)";
      } else {
        const json = await res.json().catch(() => ({}));
        details = `Gagal: ${json.error?.message || `HTTP ${res.status}`}`;
      }
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    return NextResponse.json({ connected, details });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
