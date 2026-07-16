import fs from "fs";
import path from "path";

const dbPath = path.resolve(__dirname, "../db.json");

if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

  db.aiFields = [
    { field_key: "ocr_id_document", display_name: "Passport, KTP, dan ID lainnya", description: "Mengekstrak data identitas resmi", auto_mode: true },
    { field_key: "ocr_travel_document", display_name: "Flight ticket, boarding pass, itinerary perjalanan", description: "Mengekstrak data perjalanan", auto_mode: true },
    { field_key: "ocr_financial_document", display_name: "Bank statement dan dokumen transaksi", description: "Mengekstrak data keuangan", auto_mode: true },
    { field_key: "ocr_general_document", display_name: "CV, kontrak kerja, dokumen umum lainnya", description: "Mengekstrak data teks umum", auto_mode: true },
    { field_key: "orchestrator", display_name: "Koordinasi antar-agent dan keputusan routing", description: "Otak utama orkestrasi agent", auto_mode: true },
    { field_key: "chatbot", display_name: "Chat widget customer-facing", description: "Widget chat interaktif pelanggan", auto_mode: true },
    { field_key: "reasoning_general", display_name: "Analisis dan pengambilan keputusan kompleks", description: "Penalaran tingkat tinggi", auto_mode: true },
    { field_key: "face_liveness_scan", display_name: "reserved placeholder only", description: "Pencocokan biometrik wajah (non-aktif)", auto_mode: false }
  ];

  db.fieldPoolAssignments = [
    { id: "a1", field_key: "ocr_id_document", provider: "gemini", pool_tier: 1 },
    { id: "a2", field_key: "ocr_id_document", provider: "gpt", pool_tier: 2 },
    { id: "a3", field_key: "ocr_travel_document", provider: "gemini", pool_tier: 1 },
    { id: "a4", field_key: "ocr_travel_document", provider: "gpt", pool_tier: 2 },
    { id: "a5", field_key: "ocr_financial_document", provider: "gemini", pool_tier: 1 },
    { id: "a6", field_key: "ocr_financial_document", provider: "gpt", pool_tier: 2 },
    { id: "a7", field_key: "ocr_general_document", provider: "gemini", pool_tier: 1 },
    { id: "a8", field_key: "ocr_general_document", provider: "gpt", pool_tier: 2 },
    { id: "a9", field_key: "orchestrator", provider: "claude", pool_tier: 1 },
    { id: "a10", field_key: "orchestrator", provider: "gpt", pool_tier: 2 },
    { id: "a11", field_key: "reasoning_general", provider: "claude", pool_tier: 1 },
    { id: "a12", field_key: "reasoning_general", provider: "gpt", pool_tier: 2 },
    { id: "a13", field_key: "chatbot", provider: "gpt", pool_tier: 1 },
    { id: "a14", field_key: "chatbot", provider: "claude", pool_tier: 2 },
    { id: "a15", field_key: "chatbot", provider: "deepseek", pool_tier: 3 }
  ];

  // Add field_key and pool_tier_used to existing usageLogs
  db.usageLogs = (db.usageLogs || []).map((log: any) => ({
    ...log,
    field_key: log.field_key || "reasoning_general",
    pool_tier_used: log.pool_tier_used || 1
  }));

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
  console.log("Seeded db.json successfully with job routing tables!");
} else {
  console.log("db.json not found");
}
