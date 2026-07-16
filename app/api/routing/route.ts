import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// local mock fallback if Supabase is offline/not configured
import fs from "fs";
import path from "path";

const dbPath = path.resolve(process.cwd(), "db.json");

function readLocalDb() {
  if (fs.existsSync(dbPath)) {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  }
  return {};
}

function writeLocalDb(data: any) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
}

export async function GET(req: NextRequest) {
  if (!supabaseAdmin) {
    // Fallback to local db.json
    const db = readLocalDb();
    const fields = db.aiFields || [];
    const assignments = db.fieldPoolAssignments || [];
    const logs = db.usageLogs || [];

    const lastUsedMap: Record<string, number> = {};
    [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).forEach(log => {
      if (log.field_key && !lastUsedMap[log.field_key]) {
        lastUsedMap[log.field_key] = log.pool_tier_used;
      }
    });

    const responseData = fields.map((f: any) => {
      const fieldAsns = assignments.filter((a: any) => a.field_key === f.field_key);
      return {
        ...f,
        assignments: fieldAsns,
        last_tier_used: lastUsedMap[f.field_key] || null
      };
    });

    return NextResponse.json(responseData);
  }

  try {
    const [fieldsRes, assignmentsRes, logsRes] = await Promise.all([
      supabaseAdmin.from("gw_ai_fields").select("*"),
      supabaseAdmin.from("gw_field_pool_assignments").select("*").order("pool_tier", { ascending: true }),
      supabaseAdmin.from("gw_usage_logs").select("field_key, pool_tier_used, created_at").order("created_at", { ascending: false })
    ]);

    if (fieldsRes.error) throw new Error(fieldsRes.error.message);

    const lastUsedMap: Record<string, number> = {};
    (logsRes.data || []).forEach(log => {
      if (log.field_key && !lastUsedMap[log.field_key]) {
        lastUsedMap[log.field_key] = log.pool_tier_used;
      }
    });

    const responseData = (fieldsRes.data || []).map((f) => {
      const fieldAsns = (assignmentsRes.data || []).filter((a) => a.field_key === f.field_key);
      return {
        ...f,
        assignments: fieldAsns,
        last_tier_used: lastUsedMap[f.field_key] || null
      };
    });

    return NextResponse.json(responseData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (!supabaseAdmin) {
    // Local fallback
    const db = readLocalDb();
    if (!db.aiFields) db.aiFields = [];
    if (!db.fieldPoolAssignments) db.fieldPoolAssignments = [];

    if (action === "add_field") {
      const { field_key, display_name, description, auto_mode } = body;
      if (!field_key || !display_name) {
        return NextResponse.json({ error: "field_key and display_name are required" }, { status: 400 });
      }
      if (db.aiFields.some((f: any) => f.field_key === field_key)) {
        return NextResponse.json({ error: "Field key already exists" }, { status: 400 });
      }
      const newField = { field_key, display_name, description, auto_mode: auto_mode ?? true };
      db.aiFields.push(newField);
      writeLocalDb(db);
      return NextResponse.json(newField);
    }

    if (action === "toggle_auto_mode") {
      const { field_key, auto_mode } = body;
      const idx = db.aiFields.findIndex((f: any) => f.field_key === field_key);
      if (idx === -1) return NextResponse.json({ error: "Field not found" }, { status: 404 });
      db.aiFields[idx].auto_mode = auto_mode;
      writeLocalDb(db);
      return NextResponse.json(db.aiFields[idx]);
    }

    if (action === "update_assignments") {
      const { field_key, assignments } = body; // assignments is array of { provider, pool_tier }
      if (!field_key || !Array.isArray(assignments)) {
        return NextResponse.json({ error: "field_key and assignments array are required" }, { status: 400 });
      }
      // Remove old assignments
      db.fieldPoolAssignments = db.fieldPoolAssignments.filter((a: any) => a.field_key !== field_key);
      // Insert new ones
      assignments.forEach((asn: any, i: number) => {
        db.fieldPoolAssignments.push({
          id: `a-${field_key}-${i}-${Math.random().toString(36).substring(2, 5)}`,
          field_key,
          provider: asn.provider,
          pool_tier: asn.pool_tier
        });
      });
      writeLocalDb(db);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    if (action === "add_field") {
      const { field_key, display_name, description, auto_mode } = body;
      if (!field_key || !display_name) {
        return NextResponse.json({ error: "field_key and display_name are required" }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from("gw_ai_fields")
        .insert({ field_key, display_name, description, auto_mode: auto_mode ?? true })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    if (action === "toggle_auto_mode") {
      const { field_key, auto_mode } = body;
      const { data, error } = await supabaseAdmin
        .from("gw_ai_fields")
        .update({ auto_mode })
        .eq("field_key", field_key)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    if (action === "update_assignments") {
      const { field_key, assignments } = body; // assignments is array of { provider, pool_tier }
      if (!field_key || !Array.isArray(assignments)) {
        return NextResponse.json({ error: "field_key and assignments array are required" }, { status: 400 });
      }
      // Delete old assignments
      await supabaseAdmin
        .from("gw_field_pool_assignments")
        .delete()
        .eq("field_key", field_key);

      if (assignments.length > 0) {
        const toInsert = assignments.map(a => ({
          field_key,
          provider: a.provider,
          pool_tier: a.pool_tier
        }));
        const { error: insErr } = await supabaseAdmin
          .from("gw_field_pool_assignments")
          .insert(toInsert);
        if (insErr) throw new Error(insErr.message);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
