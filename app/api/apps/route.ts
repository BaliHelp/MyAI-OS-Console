import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { data: apps, error } = await supabaseAdmin
    .from("gw_client_apps")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with active key count
  const { data: keys } = await supabaseAdmin
    .from("gw_api_keys")
    .select("client_app_id, status");

  const enriched = (apps ?? []).map((app: Record<string, unknown>) => ({
    ...app,
    key_count: (keys ?? []).filter(
      (k: { client_app_id: string; status: string }) =>
        k.client_app_id === app.id && k.status === "active"
    ).length,
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { name, slug, tier } = await req.json();

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("gw_client_apps")
    .insert({ name, slug, tier: tier ?? "internal", status: "active" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug sudah digunakan. Pilih slug yang berbeda." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
