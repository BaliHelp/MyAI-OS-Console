import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { saveToDataCenter } from "@/lib/data-center";
import fs from "fs";
import path from "path";

const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const dbJsonPath = path.resolve(projectRoot, "db.json");

// 1. GET ALL RECORDS (Enforces Admin Auth)
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("gw_data_center")
      .select("*, gw_client_apps(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api-data-center] Fetch error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map nested join to clean format
    const mapped = (data || []).map((row: any) => ({
      ...row,
      app_name: row.gw_client_apps?.name || "Internal / Global"
    }));

    return NextResponse.json(mapped);
  } else {
    // Local fallback
    if (fs.existsSync(dbJsonPath)) {
      const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
      const records = db.dataCenter || [];
      const apps = db.clientApps || [];

      const mapped = records.map((r: any) => {
        const app = apps.find((a: any) => a.id === r.client_app_id);
        return {
          ...r,
          app_name: app ? app.name : "Internal / Global"
        };
      }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return NextResponse.json(mapped);
    }
    return NextResponse.json([]);
  }
}

// 2. INSERT MANUAL DOCUMENT (Enforces Admin Auth)
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { raw_text, file, fileMimeType, tags, language, document_type } = body;

    const dataCenterId = await saveToDataCenter({
      client_app_id: null, // manual documents uploaded by admin are null-scoped
      field_key: null,
      source_type: "manual_document",
      document_type: document_type || "manual_document",
      raw_text: raw_text || null,
      language: language || "id",
      tags: tags || [],
      fileBase64: file || null,
      fileMimeType: fileMimeType || null,
      manual_review_required: false,
      confidence_score: 1.0
    });

    if (!dataCenterId) {
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data_center_id: dataCenterId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process manual upload" }, { status: 500 });
  }
}
