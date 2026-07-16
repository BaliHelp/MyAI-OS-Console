import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptKey } from "@/lib/crypto";

import { importEnvProviderKeys } from "@/lib/migrate";

export async function GET(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    // Run sync
    await importEnvProviderKeys();

    const { data, error } = await supabaseAdmin
      .from("gw_provider_keys")
      .select("id, provider, label, key_encrypted, status");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const keys = (data || []).map((k) => {
      let raw = "";
      try {
        raw = decryptKey(k.key_encrypted);
      } catch {
        raw = "DECRYPT_FAILED";
      }
      return {
        id: k.id,
        provider: k.provider,
        label: k.label,
        status: k.status,
        raw: raw
      };
    });

    const envKeys = Object.keys(process.env)
      .filter((k) => k.includes("OPENAI") || k.includes("CLAUDE") || k.includes("GROK"))
      .reduce((acc: any, key) => {
        const val = process.env[key] || "";
        acc[key] = val.length > 8 ? `${val.substring(0, 8)}...${val.substring(val.length - 4)}` : "too short";
        return acc;
      }, {});

    // Debug the exact import check for OPENAI_API_KEY2
    const debugVar = "OPENAI_API_KEY2";
    const rawVal = process.env[debugVar] || "";
    const trimmed = rawVal.trim();
    const decryptedRawKeys = new Set<string>();
    
    for (const k of data || []) {
      try {
        const decrypted = decryptKey(k.key_encrypted);
        if (decrypted) decryptedRawKeys.add(decrypted.trim());
      } catch (err) {}
    }

    const hasInDB = decryptedRawKeys.has(trimmed);
    const length = trimmed.length;

    console.log("DB keys diagnostic:", keys);
    return NextResponse.json({ 
      dbKeys: keys, 
      envKeys,
      debug: {
        var: debugVar,
        length,
        hasInDB,
        inEnv: !!rawVal
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
