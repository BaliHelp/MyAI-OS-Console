import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { encryptKey, decryptKey, maskKey } from "@/lib/crypto";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { data, error } = await supabaseAdmin
    .from("gw_provider_keys")
    .select("id, provider, label, status, usage_count, last_used_at, created_at, key_encrypted, base_url, model_name")
    .order("label", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Decrypt and return both masked and plain key
  const processed = (data ?? []).map((k: Record<string, unknown>) => {
    let maskedKey = "••••••••";
    let plainKey = "";
    try {
      const plain = decryptKey(k.key_encrypted as string);
      maskedKey = maskKey(plain);
      plainKey = plain;
    } catch {}
    return { ...k, key_encrypted: undefined, key_masked: maskedKey, key_plain: plainKey };
  });

  return NextResponse.json(processed);
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { provider, label, api_key, base_url, model_name } = await req.json();

  if (!provider || !api_key) {
    return NextResponse.json({ error: "provider and api_key are required" }, { status: 400 });
  }

  const keyEncrypted = encryptKey(api_key);

  const { data, error } = await supabaseAdmin
    .from("gw_provider_keys")
    .insert({ 
      provider, 
      label: label ?? null, 
      key_encrypted: keyEncrypted, 
      status: "active",
      base_url: base_url ?? null,
      model_name: model_name ?? null
    })
    .select("id, provider, label, status, usage_count, last_used_at, created_at, base_url, model_name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("gw_provider_keys")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH to toggle status (active/disabled)
export async function PATCH(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status are required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("gw_provider_keys")
    .update({ status })
    .eq("id", id)
    .select("id, provider, label, status, usage_count, last_used_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
