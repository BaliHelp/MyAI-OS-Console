import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Password saat ini dan password baru wajib diisi." }, { status: 400 });
  }

  try {
    // Fetch user from DB
    const { data: user, error: fetchError } = await supabaseAdmin
      .from("gw_users")
      .select("*")
      .eq("email", session.email)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Default hash fallback if not in DB yet
    let dbHash = process.env.ADMIN_PASSWORD_HASH || "";
    if (user?.password_hash) {
      dbHash = user.password_hash;
    }

    if (!dbHash) {
      return NextResponse.json({ error: "Password hash tidak terkonfigurasi di server." }, { status: 500 });
    }

    // Verify current password
    const isBcrypt = dbHash.startsWith("$2a$") || dbHash.startsWith("$2b$");
    const isValid = isBcrypt
      ? await bcrypt.compare(currentPassword, dbHash)
      : currentPassword === dbHash;

    if (!isValid) {
      return NextResponse.json({ error: "Password saat ini salah." }, { status: 400 });
    }

    // Hash new password
    const newHash = bcrypt.hashSync(newPassword, 10);

    // Upsert password hash in gw_users
    if (user?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("gw_users")
        .update({ password_hash: newHash })
        .eq("id", user.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("gw_users")
        .insert({
          email: session.email,
          password_hash: newHash,
          role: "owner"
        });
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Gagal mengubah password: ${msg}` }, { status: 500 });
  }
}
