import fs from "fs";
import path from "path";

// Load environment variables from .env.local
const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const envPath = path.resolve(projectRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const file = fs.readFileSync(envPath, "utf8");
  file.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      process.env[key] = val;
    }
  });
}

import { createClient } from "@supabase/supabase-js";

(global as any).WebSocket = class {};

// Source credentials (old 'mybisnis' project)
const sourceUrl = "https://ysjvlvlzbxpkxvajehbh.supabase.co";
const sourceServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzanZsdmx6Ynhwa3h2YWplaGJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjUzNTA0OSwiZXhwIjoyMDgyMTExMDQ5fQ.BuzGm59Dzbkf5-WILxFEly9VKzmmU9BNNC6X-UbG6Xo";

// Target credentials (new 'myai-os-gateway' project, loaded from .env.local)
const targetUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const targetServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!targetUrl || !targetServiceRoleKey) {
  console.error("Error: Missing target project credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) in .env.local");
  process.exit(1);
}

console.log(`Source Supabase Project (mybisnis) URL: ${sourceUrl}`);
console.log(`Target Supabase Project (myai-os-gateway) URL: ${targetUrl}`);

const sourceClient = createClient(sourceUrl, sourceServiceRoleKey, { auth: { persistSession: false } });
const targetClient = createClient(targetUrl, targetServiceRoleKey, { auth: { persistSession: false } });

async function migrateTable(tableName: string, uniqueKey: string = "id") {
  console.log(`\n--- Migrating table: ${tableName} ---`);
  
  // 1. Fetch data from source
  const { data: rows, error: fetchErr } = await sourceClient
    .from(tableName)
    .select("*");

  if (fetchErr) {
    if (fetchErr.message.includes("Could not find the table") || fetchErr.message.includes("does not exist")) {
      console.warn(`[Warning] Table ${tableName} does not exist on source project. Skipping since target has default seed values.`);
      return true;
    }
    console.error(`Error fetching from ${tableName}:`, fetchErr.message);
    return false;
  }

  console.log(`Fetched ${rows?.length || 0} rows from source.`);

  if (!rows || rows.length === 0) {
    console.log(`Skipping migration for ${tableName} (empty).`);
    return true;
  }

  // 2. Insert/Upsert into target
  const { error: upsertErr } = await targetClient
    .from(tableName)
    .upsert(rows, { onConflict: uniqueKey });

  if (upsertErr) {
    console.error(`Error upserting into ${tableName}:`, upsertErr.message);
    return false;
  }

  console.log(`Successfully migrated ${rows.length} rows to target.`);
  return true;
}

async function run() {
  console.log("=== STARTING SUPABASE CROSS-PROJECT DATA MIGRATION ===");
  
  // Order matters due to foreign key constraints
  const migrationPlan = [
    { name: "gw_users", key: "id" },
    { name: "gw_client_apps", key: "id" },
    { name: "gw_api_keys", key: "id" },
    { name: "gw_business_profile", key: "id" },
    { name: "gw_knowledge_documents", key: "id" },
    { name: "gw_provider_keys", key: "id" },
    { name: "gw_rate_limit_buckets", key: "id" },
    { name: "gw_ai_fields", key: "field_key" },
    { name: "gw_field_pool_assignments", key: "id" },
    { name: "gw_usage_logs", key: "id" }
  ];

  let allSuccess = true;
  for (const table of migrationPlan) {
    const ok = await migrateTable(table.name, table.key);
    if (!ok) {
      allSuccess = false;
      console.error(`Migration FAILED at table ${table.name}. Stopping pipeline.`);
      break;
    }
  }

  if (allSuccess) {
    console.log("\n=======================================================");
    console.log("🎉 DATA MIGRATION COMPLETED SUCCESSFULLY FOR ALL TABLES");
    console.log("=======================================================");
    process.exit(0);
  } else {
    console.log("\n=======================================================");
    console.log("💥 DATA MIGRATION FAILED");
    console.log("=======================================================");
    process.exit(1);
  }
}

run();
