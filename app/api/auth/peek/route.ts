import { NextResponse } from "next/server";

export async function GET() {
  const email = process.env.ADMIN_EMAIL || "rimbanusaonline@gmail.com";
  const hash = process.env.ADMIN_PASSWORD_HASH || "";

  // Check if hash is bcrypt
  const isBcrypt = hash.startsWith("$2a$") || hash.startsWith("$2b$");

  return NextResponse.json({
    email,
    password: isBcrypt ? "Bali2026 (Terenkripsi Bcrypt di .env.local)" : hash,
    isBcrypt,
  });
}
