import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  destroySession(res);
  return res;
}
