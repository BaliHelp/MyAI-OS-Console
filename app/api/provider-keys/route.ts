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

  // Masked only — every provider secret used to ship to the browser in plaintext on every
  // load of this list, whether or not "reveal" was ever clicked, since the toggle just showed
  ///hid data already sitting in React state. Full plaintext is now only reachable one key at a
  // time via GET /api/provider-keys/[id]/reveal, on demand.
  const processed = (data ?? []).map((k: Record<string, unknown>) => {
    let maskedKey = "••••••••";
    try {
      maskedKey = maskKey(decryptKey(k.key_encrypted as string));
    } catch {}
    return { ...k, key_encrypted: undefined, key_masked: maskedKey };
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

// PATCH to update status (active/disabled) and/or model_name/base_url.
// model_name/base_url are distinguished from "not provided" via `in` checks (not `!== undefined`
// alone) so a caller can explicitly clear either back to null (revert to the adapter default)
// by sending `model_name: null`, not just omit the field.
export async function PATCH(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const body = await req.json();
  const { id } = body;
  const hasStatus = "status" in body;
  const hasModelName = "model_name" in body;
  const hasBaseUrl = "base_url" in body;

  if (!id || (!hasStatus && !hasModelName && !hasBaseUrl)) {
    return NextResponse.json({ error: "id and at least one of status/model_name/base_url are required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (hasStatus) update.status = body.status;
  if (hasModelName) update.model_name = body.model_name;
  if (hasBaseUrl) update.base_url = body.base_url;

  const { data, error } = await supabaseAdmin
    .from("gw_provider_keys")
    .update(update)
    .eq("id", id)
    .select("id, provider, label, status, usage_count, last_used_at, base_url, model_name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
