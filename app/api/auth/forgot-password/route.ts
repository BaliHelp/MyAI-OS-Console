import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

/**
 * This endpoint is listed in proxy.ts's PUBLIC_PATHS — reachable with no session cookie at
 * all. It used to reset ANY account whose email you could guess/know to a hardcoded password
 * ("Bali2026") and hand that password straight back in the response body: a complete,
 * unauthenticated account-takeover path, not a real "forgot password" flow.
 *
 * This is a single-owner internal console with no email provider wired up, so a real
 * emailed-token reset isn't available. The safe equivalent for that shape: gate the whole
 * endpoint behind a server-only secret that never reaches a browser (parallel to how
 * CRON_SECRET gates the Indonesian Visas cron endpoints) — only someone with direct access to
 * the server's environment variables (i.e. the actual owner) can trigger a reset, and the
 * resulting password is freshly random each time, never a fixed known value.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const configuredSecret = process.env.PASSWORD_RESET_SECRET;
  if (!configuredSecret) {
    console.error("[forgot-password] PASSWORD_RESET_SECRET is not configured — rejecting all requests.");
    return NextResponse.json({ error: "Password recovery is not configured on this server." }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rateCheck = await checkRateLimit(ip, RATE_LIMITS.FORGOT_PASSWORD);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi dalam ${RATE_LIMITS.FORGOT_PASSWORD.windowMinutes} menit.` },
      { status: 429 }
    );
  }

  const { email, recoverySecret } = await req.json();

  if (!email || !recoverySecret) {
    return NextResponse.json({ error: "Email dan kode pemulihan wajib diisi." }, { status: 400 });
  }

  if (!safeEqual(String(recoverySecret), configuredSecret)) {
    await logAudit({ action: "forgot_password_denied", actorEmail: email, targetType: "auth", detail: { reason: "wrong_recovery_secret" }, ipAddress: ip });
    return NextResponse.json({ error: "Kode pemulihan salah." }, { status: 401 });
  }

  try {
    const { data: user } = await supabaseAdmin
      .from("gw_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: "Email tidak terdaftar di sistem." }, { status: 400 });
    }

    // Fresh random password every time — never a fixed, guessable value.
    const newPassword = crypto.randomBytes(18).toString("base64url");
    const hash = bcrypt.hashSync(newPassword, 10);

    const { error: updateError } = await supabaseAdmin
      .from("gw_users")
      .update({ password_hash: hash })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await logAudit({ action: "forgot_password_reset", actorEmail: email, targetType: "auth", detail: {}, ipAddress: ip });

    // Returned directly rather than emailed — the only caller who can ever reach this
    // point already holds the server-only recovery secret, which is the actual auth
    // boundary here.
    return NextResponse.json({
      success: true,
      message: "Password berhasil direset.",
      newPassword,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Gagal mereset password: ${msg}` }, { status: 500 });
  }
}
