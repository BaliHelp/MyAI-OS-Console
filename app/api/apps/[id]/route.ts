import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import fs from "fs";
import path from "path";

const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const dbJsonPath = path.resolve(projectRoot, "db.json");

/**
 * PATCH /api/apps/[id]
 * Requires admin session (role === "owner").
 * Renames a client app (gw_client_apps.name only — slug/tier/status untouched).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: appId } = await params;
  if (!appId) {
    return NextResponse.json({ error: "Application ID is required" }, { status: 400 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const trimmedName = name.trim();

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("gw_client_apps")
      .update({ name: trimmedName })
      .eq("id", appId)
      .select()
      .single();

    if (error) {
      console.error("[api/apps/patch] Error renaming application:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } else {
    // Local db.json fallback
    if (fs.existsSync(dbJsonPath)) {
      const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
      const app = (db.clientApps ?? []).find((a: any) => a.id === appId);
      if (!app) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }
      app.name = trimmedName;
      fs.writeFileSync(dbJsonPath, JSON.stringify(db, null, 2), "utf8");
      return NextResponse.json(app);
    }
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

/**
 * DELETE /api/apps/[id]
 * Requires admin session (role === "owner").
 * Safely removes a client app:
 * 1. Unassigns client_app_id from gw_data_center (sets to null so history is preserved)
 * 2. Revokes/deletes all associated API keys in gw_api_keys
 * 3. Deletes the client app record from gw_client_apps
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: appId } = await params;
  if (!appId) {
    return NextResponse.json({ error: "Application ID is required" }, { status: 400 });
  }

  if (supabaseAdmin) {
    // 1. Unlink records in gw_data_center to preserve history
    const { error: unlinkError } = await supabaseAdmin
      .from("gw_data_center")
      .update({ client_app_id: null })
      .eq("client_app_id", appId);

    if (unlinkError) {
      console.warn("[api/apps/delete] Warning unlinking data center records:", unlinkError.message);
    }

    // 2. Delete associated API keys
    const { error: keysError } = await supabaseAdmin
      .from("gw_api_keys")
      .delete()
      .eq("client_app_id", appId);

    if (keysError) {
      console.warn("[api/apps/delete] Warning deleting API keys:", keysError.message);
    }

    // 3. Delete the application
    const { error: appError } = await supabaseAdmin
      .from("gw_client_apps")
      .delete()
      .eq("id", appId);

    if (appError) {
      console.error("[api/apps/delete] Error deleting application:", appError.message);
      return NextResponse.json({ error: appError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted_id: appId });
  } else {
    // Local db.json fallback
    if (fs.existsSync(dbJsonPath)) {
      const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
      if (db.clientApps) {
        db.clientApps = db.clientApps.filter((a: any) => a.id !== appId);
      }
      if (db.apiKeys) {
        db.apiKeys = db.apiKeys.filter((k: any) => k.client_app_id !== appId);
      }
      if (db.dataCenter) {
        db.dataCenter.forEach((r: any) => {
          if (r.client_app_id === appId) r.client_app_id = null;
        });
      }
      fs.writeFileSync(dbJsonPath, JSON.stringify(db, null, 2), "utf8");
      return NextResponse.json({ success: true, deleted_id: appId });
    }
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
