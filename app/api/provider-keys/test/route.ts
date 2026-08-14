import { NextRequest, NextResponse } from "next/server";
import { decryptKey } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { testProviderConnection } from "@/lib/test-provider-connection";

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
      .select("key_encrypted, provider, base_url, model_name")
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

    console.log(`[test-conn] Testing connection for provider: ${keyData.provider}, key id: ${id}`);

    // 3. Test connection — for custom/OpenAI-compatible providers this also probes a real
    // chat completion with the configured model_name, not just key/URL reachability, so
    // "Terkoneksi" actually reflects whether real gateway traffic would work.
    const { connected, details } = await testProviderConnection(
      keyData.provider,
      rawKey,
      keyData.base_url,
      keyData.model_name
    );

    return NextResponse.json({ connected, details });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
