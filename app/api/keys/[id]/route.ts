import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

// PATCH /api/keys/:id — update the provider_scope of an existing API key.
// Only provider_scope is editable here; key material and prefix are immutable,
// and status changes go through the dedicated /revoke route.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { provider_scope } = body;

  if (
    !Array.isArray(provider_scope) ||
    provider_scope.length === 0 ||
    !provider_scope.every((s) => typeof s === "string" && s.trim().length > 0)
  ) {
    return NextResponse.json(
      { error: "provider_scope must be a non-empty array of provider strings" },
      { status: 400 }
    );
  }

  // De-duplicate while preserving order
  const cleanScope = Array.from(new Set(provider_scope.map((s: string) => s.trim())));

  const { data: existing } = await supabaseAdmin
    .from("gw_api_keys")
    .select("provider_scope, status, key_prefix, client_app_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  if (existing.status === "revoked") {
    return NextResponse.json({ error: "Cannot edit a revoked key" }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("gw_api_keys")
    .update({ provider_scope: cleanScope })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: 'update_api_key_scope',
    targetType: 'api_key',
    targetId: id,
    detail: {
      key_prefix: existing.key_prefix,
      client_app_id: existing.client_app_id,
      old_scope: existing.provider_scope,
      new_scope: cleanScope,
    },
  });

  return NextResponse.json(data);
}
