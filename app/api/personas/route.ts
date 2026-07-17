import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/personas — list semua personas (admin only)
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("gw_chat_personas")
    .select("id, client_app_id, persona_name, tone_description, language_default, must_never_say, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/personas — buat persona baru (admin only)
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const body = await req.json();
  const { client_app_id, persona_name, tone_description, language_default, must_never_say } = body;

  if (!client_app_id || !persona_name) {
    return NextResponse.json({ error: "client_app_id dan persona_name wajib diisi" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("gw_chat_personas")
    .insert({
      client_app_id,
      persona_name: persona_name.trim(),
      tone_description: (tone_description || "").trim(),
      language_default: language_default || "id",
      must_never_say: must_never_say || [],
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation = sudah ada persona untuk client ini
    if (error.code === "23505") {
      return NextResponse.json({ error: "Client app ini sudah memiliki persona. Edit yang sudah ada." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
