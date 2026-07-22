import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptKey } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// Plaintext provider secrets used to ship with every GET /api/provider-keys list response,
// whether or not "reveal" was ever clicked. Split out so the full key only ever leaves the
// server for one key at a time, on an explicit, audited action.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("gw_provider_keys")
    .select("id, provider, label, key_encrypted")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  try {
    const key_plain = decryptKey(data.key_encrypted);
    await logAudit({
      action: "reveal_provider_key",
      targetType: "provider_key",
      targetId: id,
      detail: { provider: data.provider, label: data.label },
    });
    return NextResponse.json({ key_plain });
  } catch (e) {
    return NextResponse.json({ error: "Failed to decrypt key" }, { status: 500 });
  }
}
