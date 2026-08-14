import { NextRequest, NextResponse } from "next/server";
import { decryptKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { testProviderConnection } from "@/lib/test-provider-connection";

export async function GET(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    // 1. Fetch all keys from DB sorted by label and created_at ascending
    const { data: keys, error: fetchError } = await supabaseAdmin
      .from("gw_provider_keys")
      .select("id, provider, label, key_encrypted, status, base_url, model_name")
      .eq("status", "active")
      .order("label", { ascending: true })
      .order("created_at", { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!keys || keys.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Map and test in parallel using Promise.all — for custom/OpenAI-compatible providers
    // this also probes a real chat completion with the configured model_name, not just
    // key/URL reachability, so "Terkoneksi" actually reflects whether real gateway traffic
    // would work (a key can pass the old /models-only check while every real request fails —
    // e.g. wrong model id, suspended billing).
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

        const { connected, details } = await testProviderConnection(k.provider, rawKey, k.base_url, k.model_name);

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
