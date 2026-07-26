import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const supabaseUrl = process.env.GATEWAY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.GATEWAY_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!(globalThis as any).WebSocket) {
  (globalThis as any).WebSocket = class {};
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function main() {
  console.log("Updating gw_client_apps table in Supabase...");

  const updates = [
    { oldSlug: "mybusiness-website", newName: "MyIndo App Website", newSlug: "myindo-website" },
    { oldSlug: "mybusiness-playstore", newName: "MyIndo App Playstore", newSlug: "myindo-playstore" },
    { oldSlug: "mybusiness-appstore", newName: "MyIndo App Store", newSlug: "myindo-appstore" },
  ];

  for (const item of updates) {
    const { data, error } = await supabase
      .from("gw_client_apps")
      .update({ name: item.newName, slug: item.newSlug })
      .eq("slug", item.oldSlug)
      .select();

    if (error) {
      console.warn(`Warning updating ${item.oldSlug}:`, error.message);
    } else {
      console.log(`✅ Rebranded app: ${item.oldSlug} -> ${item.newName} (${item.newSlug})`);
    }
  }

  // Also check if any apps still have "MyBusiness" in their name
  const { data: remaining } = await supabase
    .from("gw_client_apps")
    .select("id, name, slug");
  
  console.log("Current Client Apps in DB:", remaining);
}

main().catch(console.error);
