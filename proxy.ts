import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// Routes that do NOT require authentication
const PUBLIC_PATHS = [
  "/login",
  "/terms",
  "/privacy",
  "/docs",
  "/api-reference",
  "/examples",
  "/guides",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/v1/chat/completions",
  "/_next",
  "/favicon.ico"
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets directly from root
  if (
    pathname.endsWith(".webp") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next();
  }

  // Protect all other routes
  const session = await getSession(req);
  if (!session || session.role !== 'owner') {
    // API routes return 401, pages redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and _next internals
    "/((?!_next/static|_next/image|favicon.ico|assets).*)",
  ],
};
