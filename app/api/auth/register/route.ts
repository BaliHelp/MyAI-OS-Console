import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
  }

  try {
    // Check if email already registered in gw_users
    const { data: existing } = await supabaseAdmin
      .from("gw_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar. Silakan login." }, { status: 400 });
    }

    // Hash password with bcrypt
    const passwordHash = bcrypt.hashSync(password, 10);

    // Insert user
    const { error: insertError } = await supabaseAdmin
      .from("gw_users")
      .insert({
        email,
        password_hash: passwordHash,
        role: "owner"
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Gagal membuat akun: ${msg}` }, { status: 500 });
  }
}
