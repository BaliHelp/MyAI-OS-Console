import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// PUT /api/personas/[id] — update persona
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { id } = await params;
  const body = await req.json();
  const { persona_name, tone_description, language_default, must_never_say } = body;

  const { data, error } = await supabaseAdmin
    .from("gw_chat_personas")
    .update({
      persona_name: persona_name?.trim(),
      tone_description: (tone_description || "").trim(),
      language_default: language_default || "id",
      must_never_say: must_never_say || [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Persona tidak ditemukan" }, { status: 404 });

  return NextResponse.json(data);
}

// DELETE /api/personas/[id] — hapus persona
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("gw_chat_personas")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
