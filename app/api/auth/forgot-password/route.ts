import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
  }

  try {
    // Check if user exists
    const { data: user } = await supabaseAdmin
      .from("gw_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: "Email tidak terdaftar di sistem." }, { status: 400 });
    }

    // Reset password to default "Bali2026"
    const defaultPassword = "Bali2026";
    const hash = bcrypt.hashSync(defaultPassword, 10);

    const { error: updateError } = await supabaseAdmin
      .from("gw_users")
      .update({ password_hash: hash })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Password berhasil direset ke sandi default ekosistem: "${defaultPassword}"`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Gagal mereset password: ${msg}` }, { status: 500 });
  }
}
