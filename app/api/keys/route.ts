import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { hashApiKey } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// Math.random() is not cryptographically secure and its internal state is predictable —
// unacceptable for the actual secret material of a gateway API key. crypto was already
// imported in this file; nothing else here used it for the key itself.
const uuid = () => crypto.randomBytes(16).toString("hex");

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { data, error } = await supabaseAdmin
    .from("gw_api_keys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { client_app_id, provider_scope, rate_limit_per_day } = await req.json();

  if (!client_app_id) {
    return NextResponse.json({ error: "client_app_id is required" }, { status: 400 });
  }

  // Find app for prefix generation
  const { data: app } = await supabaseAdmin
    .from("gw_client_apps")
    .select("slug")
    .eq("id", client_app_id)
    .single();

  const appPrefix = app ? app.slug.substring(0, 8).replace(/-/g, "") : "key";
  const prefixSuffix = uuid().substring(0, 4);
  const keyPrefix = `sk_${appPrefix}_${prefixSuffix}`;
  const fullKey = `${keyPrefix}_${uuid()}`;

  // Hash the full key (SHA-256) — never store plaintext
  const keyHash = hashApiKey(fullKey);

  const { data: newKey, error } = await supabaseAdmin
    .from("gw_api_keys")
    .insert({
      client_app_id,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      provider_scope: provider_scope ?? ["claude", "gpt", "gemini"],
      rate_limit_per_day: rate_limit_per_day ? parseInt(rate_limit_per_day) : null,
      status: "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: 'create_api_key',
    targetType: 'api_key',
    targetId: newKey?.id,
    detail: { client_app_id, key_prefix: keyPrefix, provider_scope, has_rate_limit: !!rate_limit_per_day },
  });

  // Return full_key ONLY this once — it will never be retrievable again
  return NextResponse.json({ ...newKey, full_key: fullKey }, { status: 201 });
}
