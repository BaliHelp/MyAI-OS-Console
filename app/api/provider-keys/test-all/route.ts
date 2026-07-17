import { NextRequest, NextResponse } from "next/server";
import { decryptKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    // 1. Fetch all keys from DB sorted by label and created_at ascending
    const { data: keys, error: fetchError } = await supabaseAdmin
      .from("gw_provider_keys")
      .select("id, provider, label, key_encrypted, status")
      .eq("status", "active")
      .order("label", { ascending: true })
      .order("created_at", { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!keys || keys.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Map and test in parallel using Promise.all
    const results = await Promise.all(
      keys.map(async (k) => {
        let rawKey = "";
        try {
          rawKey = decryptKey(k.key_encrypted);
        } catch {
          return { id: k.id, provider: k.provider, label: k.label, connected: false, details: "Decrypt failed" };
        }

        if (!rawKey) {
          return { id: k.id, provider: k.provider, label: k.label, connected: false, details: "Empty key" };
        }

        let connected = false;
        let details = "";

        try {
          if (k.provider === "gemini") {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${rawKey}`, { signal: AbortSignal.timeout(5000) });
            if (res.status === 200) {
              connected = true;
              details = "OK";
            } else {
              details = `HTTP ${res.status}`;
            }
          } else if (k.provider === "gpt") {
            const res = await fetch("https://api.openai.com/v1/models", {
              headers: { "Authorization": `Bearer ${rawKey}` },
              signal: AbortSignal.timeout(5000)
            });
            if (res.status === 200) {
              connected = true;
              details = "OK";
            } else {
              details = `HTTP ${res.status}`;
            }
          } else if (k.provider === "claude") {
            const res = await fetch("https://api.anthropic.com/v1/models", {
              headers: { "x-api-key": rawKey, "anthropic-version": "2023-06-01" },
              signal: AbortSignal.timeout(5000)
            });
            if (res.status === 200) {
              connected = true;
              details = "OK";
            } else {
              details = `HTTP ${res.status}`;
            }
          } else if (k.provider === "grok") {
            const res = await fetch("https://api.x.ai/v1/models", {
              headers: { "Authorization": `Bearer ${rawKey}` },
              signal: AbortSignal.timeout(5000)
            });
            if (res.status === 200) {
              connected = true;
              details = "OK";
            } else {
              details = `HTTP ${res.status}`;
            }
          } else if (k.provider === "deepseek") {
            const res = await fetch("https://api.deepseek.com/models", {
              headers: { "Authorization": `Bearer ${rawKey}` },
              signal: AbortSignal.timeout(5000)
            });
            if (res.status === 200) {
              connected = true;
              details = "OK";
            } else {
              details = `HTTP ${res.status}`;
            }
          } else {
            details = "Unknown provider";
          }
        } catch (err: any) {
          details = "Timeout/Error";
        }

        return {
          id: k.id,
          provider: k.provider,
          label: k.label,
          connected,
          details
        };
      })
    );

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
