import { supabaseAdmin } from "../lib/supabase";
import { decryptKey } from "../lib/crypto";
import fs from "fs";
import path from "path";

// Manually load env from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
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

// Re-import supabase after process.env is set
const { supabaseAdmin: client } = require("../lib/supabase");

async function listKeys() {
  if (!client) {
    console.error("Supabase admin not configured");
    return;
  }

  const { data, error } = await client
    .from("gw_provider_keys")
    .select("id, provider, label, key_encrypted, status");

  if (error) {
    console.error("Error fetching keys:", error);
    return;
  }

  console.log(`Found ${data.length} keys in gw_provider_keys:`);
  data.forEach((k: any) => {
    let raw = "";
    try {
      raw = decryptKey(k.key_encrypted);
    } catch {
      raw = "DECRYPT_FAILED";
    }
    const masked = raw.length > 8 ? `${raw.substring(0, 8)}...${raw.substring(raw.length - 4)}` : "too short";
    console.log(`- ID: ${k.id} | Provider: ${k.provider} | Label: ${k.label} | Status: ${k.status} | Key: ${masked}`);
  });
}

listKeys();
