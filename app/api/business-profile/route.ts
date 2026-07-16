import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { data, error } = await supabaseAdmin
    .from("gw_business_profile")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { content } = await req.json();

  // Get existing profile id
  const { data: existing } = await supabaseAdmin
    .from("gw_business_profile")
    .select("id")
    .limit(1)
    .single();

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from("gw_business_profile")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } else {
    const { data, error } = await supabaseAdmin
      .from("gw_business_profile")
      .insert({ title: "MyBusiness Ecosystem Core", content })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
}
