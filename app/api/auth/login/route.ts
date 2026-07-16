import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { createSession } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "rimbanusaonline@gmail.com";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";

  // ── Rate limit: 5 attempts per 15 minutes per IP ──────────────────────
  const rateCheck = await checkRateLimit(ip, RATE_LIMITS.LOGIN);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan login. Coba lagi dalam ${RATE_LIMITS.LOGIN.windowMinutes} menit.`,
      },
      {
        status: 429,
        headers: { "Retry-After": rateCheck.resetAt.toISOString() },
      }
    );
  }

  const { email, password } = await req.json();

  // ── Validate input ──────────────────────────────────────────────────────
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email dan password wajib diisi." },
      { status: 400 }
    );
  }

  // ── Check email ─────────────────────────────────────────────────────────
  if (email !== ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "Email atau password salah." },
      { status: 401 }
    );
  }

  // ── Verify password via Supabase users table (if configured) ───────────
  let passwordHash = ADMIN_PASSWORD_HASH;

  if (supabaseAdmin) {
    const { data: user } = await supabaseAdmin
      .from("gw_users")
      .select("password_hash")
      .eq("email", email)
      .single();

    if (user?.password_hash) {
      passwordHash = user.password_hash;
    }
  }

  // ── If no hash configured, block login ─────────────────────────────────
  if (!passwordHash) {
    console.error("[auth/login] ADMIN_PASSWORD_HASH is not configured!");
    return NextResponse.json(
      { error: "Server authentication not configured. Set ADMIN_PASSWORD_HASH in .env.local" },
      { status: 500 }
    );
  }

  // ── bcrypt compare or plaintext fallback ──────────────────────────────────
  const isBcrypt = passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$");
  const isValid = isBcrypt
    ? await bcrypt.compare(password, passwordHash)
    : password === passwordHash;

  if (!isValid) {
    return NextResponse.json(
      { error: "Email atau password salah." },
      { status: 401 }
    );
  }

  // ── Auto-provision user in DB if missing ────────────────────────────────
  if (supabaseAdmin) {
    try {
      const { data: userRecord } = await supabaseAdmin
        .from("gw_users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (!userRecord) {
        const hashToInsert = isBcrypt ? passwordHash : bcrypt.hashSync(password, 10);
        await supabaseAdmin.from("gw_users").insert({
          email,
          password_hash: hashToInsert,
          role: "owner"
        });
        console.log(`[auth/login] Auto-created user record for ${email}`);
      }
    } catch (err) {
      console.error("[auth/login] Failed to auto-provision user:", err);
    }
  }

  // ── Create httpOnly session cookie ─────────────────────────────────────
  const res = NextResponse.json({
    success: true,
    user: { email, role: "owner", name: "Boss Bayu" },
  });

  await createSession(res, { email, role: "owner" });
  return res;
}
