import { NextRequest, NextResponse } from "next/server";
import { syncIndonesianVisasKnowledge } from "@/lib/knowledge-sync-indonesian-visas";

// Vercel Cron invokes this via GET and — when CRON_SECRET is set on the project — automatically
// sends `Authorization: Bearer $CRON_SECRET`. This route is listed in proxy.ts's PUBLIC_PATHS
// (no session cookie exists for a cron-triggered request), so this header check is the only
// thing gating it; without CRON_SECRET configured, refuse rather than run unauthenticated.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncIndonesianVisasKnowledge();
  const allOk = results.every((r) => r.success);

  console.log("[cron/sync-knowledge] Indonesian Visas KB sync:", JSON.stringify(results));

  return NextResponse.json(
    { synced_at: new Date().toISOString(), results },
    { status: allOk ? 200 : 207 }
  );
}
