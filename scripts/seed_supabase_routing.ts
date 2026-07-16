import fs from "fs";
import path from "path";

// Manually load env from .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("Seeding Supabase with fields and assignments...");

  // 1. Seed Fields
  const fields = [
    { field_key: "ocr_id_document", display_name: "Passport, KTP, dan ID lainnya", description: "Mengekstrak data identitas resmi", auto_mode: true },
    { field_key: "ocr_travel_document", display_name: "Flight ticket, boarding pass, itinerary perjalanan", description: "Mengekstrak data perjalanan", auto_mode: true },
    { field_key: "ocr_financial_document", display_name: "Bank statement dan dokumen transaksi", description: "Mengekstrak data keuangan", auto_mode: true },
    { field_key: "ocr_general_document", display_name: "CV, kontrak kerja, dokumen umum lainnya", description: "Mengekstrak data teks umum", auto_mode: true },
    { field_key: "orchestrator", display_name: "Koordinasi antar-agent dan keputusan routing", description: "Otak utama orkestrasi agent", auto_mode: true },
    { field_key: "chatbot", display_name: "Chat widget customer-facing", description: "Widget chat interaktif pelanggan", auto_mode: true },
    { field_key: "reasoning_general", display_name: "Analisis dan pengambilan keputusan kompleks", description: "Penalaran tingkat tinggi", auto_mode: true },
    { field_key: "face_liveness_scan", display_name: "reserved placeholder only", description: "Pencocokan biometrik wajah (non-aktif)", auto_mode: false }
  ];

  for (const f of fields) {
    const { error } = await supabaseAdmin
      .from("gw_ai_fields")
      .upsert(f);
    if (error) {
      console.error(`Error seeding field ${f.field_key}:`, error.message);
    } else {
      console.log(`Seeded field: ${f.field_key}`);
    }
  }

  // 2. Seed Assignments
  const assignments = [
    { field_key: "ocr_id_document", provider: "gemini", pool_tier: 1 },
    { field_key: "ocr_id_document", provider: "gpt", pool_tier: 2 },
    { field_key: "ocr_travel_document", provider: "gemini", pool_tier: 1 },
    { field_key: "ocr_travel_document", provider: "gpt", pool_tier: 2 },
    { field_key: "ocr_financial_document", provider: "gemini", pool_tier: 1 },
    { field_key: "ocr_financial_document", provider: "gpt", pool_tier: 2 },
    { field_key: "ocr_general_document", provider: "gemini", pool_tier: 1 },
    { field_key: "ocr_general_document", provider: "gpt", pool_tier: 2 },
    { field_key: "orchestrator", provider: "claude", pool_tier: 1 },
    { field_key: "orchestrator", provider: "gpt", pool_tier: 2 },
    { field_key: "reasoning_general", provider: "claude", pool_tier: 1 },
    { field_key: "reasoning_general", provider: "gpt", pool_tier: 2 },
    { field_key: "chatbot", provider: "gpt", pool_tier: 1 },
    { field_key: "chatbot", provider: "claude", pool_tier: 2 },
    { field_key: "chatbot", provider: "deepseek", pool_tier: 3 }
  ];

  // Clear existing assignments
  const { error: delErr } = await supabaseAdmin
    .from("gw_field_pool_assignments")
    .delete()
    .neq("field_key", "none");
  if (delErr) {
    console.error("Error clearing assignments:", delErr.message);
  }

  // Insert new assignments
  const { error: insErr } = await supabaseAdmin
    .from("gw_field_pool_assignments")
    .insert(assignments);
  if (insErr) {
    console.error("Error inserting assignments:", insErr.message);
  } else {
    console.log("Seeded assignments successfully!");
  }
}

run();
