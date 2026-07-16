import fs from "fs";
import path from "path";

const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const dbJsonPath = path.resolve(projectRoot, "db.json");

if (!fs.existsSync(dbJsonPath)) {
  console.error("Error: db.json not found!");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));

// 1. Seed aiFields
const fieldsToSeed = [
  { field_key: "ocr_id_document", display_name: "Passport, KTP, dan ID lainnya", description: "Mengekstrak data identitas resmi", auto_mode: true },
  { field_key: "ocr_travel_document", display_name: "Flight ticket, boarding pass, itinerary perjalanan", description: "Mengekstrak data perjalanan", auto_mode: true },
  { field_key: "ocr_financial_document", display_name: "Bank statement dan dokumen transaksi", description: "Mengekstrak data keuangan", auto_mode: true },
  { field_key: "ocr_general_document", display_name: "CV, kontrak kerja, dokumen umum lainnya", description: "Mengekstrak data teks umum", auto_mode: true },
  { field_key: "ocr_photo_validation", display_name: "Validasi Kelayakan Foto Wajah", description: "Memeriksa kualitas teknis foto wajah", auto_mode: true },
  { field_key: "content_generation", display_name: "Asisten Pembuat Konten", description: "Membuat draf artikel blog imigrasi", auto_mode: true },
  { field_key: "coding_assistant", display_name: "Asisten Pemrograman Kode", description: "Menulis, memperbaiki, dan menjelaskan kode", auto_mode: true },
  { field_key: "chatbot_general", display_name: "Chatbot Tanya Jawab Umum", description: "Melayani pertanyaan umum pelanggan", auto_mode: true },
  { field_key: "chatbot_checkout", display_name: "Chatbot Alur Pembayaran/Checkout", description: "Membantu pelanggan menyelesaikan order", auto_mode: true },
  { field_key: "reasoning_general", display_name: "Analisis dan pengambilan keputusan kompleks", description: "Penalaran tingkat tinggi", auto_mode: true },
  { field_key: "orchestrator", display_name: "Koordinasi antar-agent dan keputusan routing", description: "Otak utama orkestrasi agent", auto_mode: true }
];

fieldsToSeed.forEach(f => {
  const idx = db.aiFields.findIndex((x: any) => x.field_key === f.field_key);
  if (idx !== -1) {
    db.aiFields[idx] = f;
  } else {
    db.aiFields.push(f);
  }
});

// Remove old 'chatbot' field if it exists
db.aiFields = db.aiFields.filter((f: any) => f.field_key !== "chatbot");

// 2. Seed fieldPoolAssignments
const assignmentsToSeed = [
  // OCR fields (tier 1=gemini, 2=deepseek, 3=grok, 4=gemini)
  { field_key: "ocr_id_document", provider: "gemini", pool_tier: 1 },
  { field_key: "ocr_id_document", provider: "deepseek", pool_tier: 2 },
  { field_key: "ocr_id_document", provider: "grok", pool_tier: 3 },
  { field_key: "ocr_id_document", provider: "gemini", pool_tier: 4 },

  { field_key: "ocr_travel_document", provider: "gemini", pool_tier: 1 },
  { field_key: "ocr_travel_document", provider: "deepseek", pool_tier: 2 },
  { field_key: "ocr_travel_document", provider: "grok", pool_tier: 3 },
  { field_key: "ocr_travel_document", provider: "gemini", pool_tier: 4 },

  { field_key: "ocr_financial_document", provider: "gemini", pool_tier: 1 },
  { field_key: "ocr_financial_document", provider: "deepseek", pool_tier: 2 },
  { field_key: "ocr_financial_document", provider: "grok", pool_tier: 3 },
  { field_key: "ocr_financial_document", provider: "gemini", pool_tier: 4 },

  { field_key: "ocr_general_document", provider: "gemini", pool_tier: 1 },
  { field_key: "ocr_general_document", provider: "deepseek", pool_tier: 2 },
  { field_key: "ocr_general_document", provider: "grok", pool_tier: 3 },
  { field_key: "ocr_general_document", provider: "gemini", pool_tier: 4 },

  { field_key: "ocr_photo_validation", provider: "gemini", pool_tier: 1 },
  { field_key: "ocr_photo_validation", provider: "deepseek", pool_tier: 2 },
  { field_key: "ocr_photo_validation", provider: "grok", pool_tier: 3 },
  { field_key: "ocr_photo_validation", provider: "gemini", pool_tier: 4 },

  // Content Generation
  { field_key: "content_generation", provider: "gpt", pool_tier: 1 },
  { field_key: "content_generation", provider: "claude", pool_tier: 2 },

  // Coding Assistant
  { field_key: "coding_assistant", provider: "claude", pool_tier: 1 },
  { field_key: "coding_assistant", provider: "gpt", pool_tier: 2 },

  // Chatbots (tier 1=gpt, 2=claude, 3=deepseek)
  { field_key: "chatbot_general", provider: "gpt", pool_tier: 1 },
  { field_key: "chatbot_general", provider: "claude", pool_tier: 2 },
  { field_key: "chatbot_general", provider: "deepseek", pool_tier: 3 },

  { field_key: "chatbot_checkout", provider: "gpt", pool_tier: 1 },
  { field_key: "chatbot_checkout", provider: "claude", pool_tier: 2 },
  { field_key: "chatbot_checkout", provider: "deepseek", pool_tier: 3 },

  // Reasoning & Orchestrator (tier 1=claude, 2=gpt)
  { field_key: "reasoning_general", provider: "claude", pool_tier: 1 },
  { field_key: "reasoning_general", provider: "gpt", pool_tier: 2 },

  { field_key: "orchestrator", provider: "claude", pool_tier: 1 },
  { field_key: "orchestrator", provider: "gpt", pool_tier: 2 }
];

// Clean old assignments
db.fieldPoolAssignments = db.fieldPoolAssignments.filter((a: any) => 
  !["ocr_id_document", "ocr_travel_document", "ocr_financial_document", "ocr_general_document", "chatbot"].includes(a.field_key)
);

// Map new ones
assignmentsToSeed.forEach((a, i) => {
  db.fieldPoolAssignments.push({
    id: `fa-json-${i + 1}`,
    ...a
  });
});

// 3. Seed fieldSpecs
const specsToSeed = [
  {
    field_key: "ocr_id_document",
    system_prompt: "Kamu adalah mesin ekstraksi OCR khusus dokumen identitas (paspor, KTP, SIM, KITAS, atau ID resmi lainnya). Ekstrak HANYA field yang ada di skema JSON berikut. Jangan menebak nilai yang tidak terbaca jelas — kembalikan null dan tambahkan catatan di warnings. Jangan pernah mengeluarkan teks apapun di luar objek JSON. Jika gambar tidak terlihat seperti dokumen identitas sama sekali, set is_valid ke false dan kosongkan field lain.",
    output_schema: { document_type: "passport|national_id|drivers_license|kitas|other_id", first_name: "string|null", last_name: "string|null", full_name: "string|null", document_number: "string|null", date_of_birth: "YYYY-MM-DD|null", nationality: "string|null", gender: "M|F|X|unknown", issued_date: "YYYY-MM-DD|null", expiry_date: "YYYY-MM-DD|null", issuing_authority: "string|null", issuing_country: "string|null", visa_type: "string|null", is_valid: "boolean", confidence_score: "number", manual_review_required: "boolean", warnings: "string[]" }
  },
  {
    field_key: "ocr_travel_document",
    system_prompt: "Kamu adalah mesin ekstraksi OCR khusus dokumen perjalanan (tiket pesawat, boarding pass, atau itinerary). Ekstrak HANYA field di skema berikut. Kembalikan null untuk nilai yang tidak terbaca. Jangan keluarkan teks di luar JSON.",
    output_schema: { document_type: "flight_ticket|boarding_pass|itinerary|other_travel", passenger_name: "string|null", flight_number: "string|null", airline: "string|null", departure_airport: "string|null", arrival_airport: "string|null", departure_date: "YYYY-MM-DD|null", departure_time: "HH:MM|null", arrival_date: "YYYY-MM-DD|null", arrival_time: "HH:MM|null", booking_reference: "string|null", is_valid: "boolean", confidence_score: "number", manual_review_required: "boolean", warnings: "string[]" }
  },
  {
    field_key: "ocr_financial_document",
    system_prompt: "Kamu adalah mesin ekstraksi OCR khusus dokumen keuangan (rekening koran/bank statement atau bukti transaksi). Ekstrak HANYA field di skema berikut sesuai document_type yang terdeteksi. Untuk nomor rekening, kembalikan HANYA 4 digit terakhir (format ****1234) — jangan pernah kembalikan nomor rekening penuh. Kembalikan null untuk nilai yang tidak terbaca.",
    output_schema: { document_type: "bank_statement|transaction_receipt|other_financial", account_holder_name: "string|null", sender_name: "string|null", bank_name: "string|null", account_number_masked: "string|null", statement_period_start: "YYYY-MM-DD|null", statement_period_end: "YYYY-MM-DD|null", closing_balance: "number|null", amount: "number|null", currency: "string|null", transaction_id: "string|null", transaction_date: "YYYY-MM-DD|null", is_valid: "boolean", confidence_score: "number", manual_review_required: "boolean", warnings: "string[]" }
  },
  {
    field_key: "ocr_general_document",
    system_prompt: "Kamu adalah mesin ekstraksi OCR untuk dokumen umum (CV, kontrak kerja, surat undangan, reservasi akomodasi, atau itinerary). Ekstrak field sesuai document_type. Untuk summary, buat ringkasan 1-2 kalimat dalam bahasa yang sama dengan dokumen asli. Kembalikan null untuk nilai yang tidak terbaca.",
    output_schema: { document_type: "cv_resume|work_contract|invitation_letter|itinerary|hotel_booking|other", title: "string|null", primary_name: "string|null", accommodation_name: "string|null", indonesia_address: "string|null", check_in_date: "YYYY-MM-DD|null", check_out_date: "YYYY-MM-DD|null", key_dates: "array|null", summary: "string|null", is_valid: "boolean", confidence_score: "number", manual_review_required: "boolean", warnings: "string[]" }
  },
  {
    field_key: "ocr_photo_validation",
    system_prompt: "Kamu adalah validator foto upload. Periksa apakah gambar ini menunjukkan foto wajah manusia yang jelas dan layak digunakan sebagai foto profil/identitas. Jangan mengidentifikasi siapa orangnya — hanya menilai kelayakan teknis foto.",
    output_schema: { is_valid_face_photo: "boolean", quality_issues: "string[]", confidence_score: "number" }
  },
  {
    field_key: "content_generation",
    system_prompt: "Kamu adalah asisten penulis konten untuk blog/berita resmi Indonesian Visas (Immigration Update). Cari topik relevan seputar regulasi imigrasi Indonesia dan tulis draf artikel informatif dan sesuai fakta, tanpa klaim jaminan hasil visa.",
    output_schema: { title: "string", summary: "string", content: "string", suggested_category: "string|null", sources_referenced: "string[]" }
  },
  {
    field_key: "coding_assistant",
    system_prompt: "Kamu adalah asisten coding yang membantu menulis, menjelaskan, atau memperbaiki kode. Ikuti instruksi pengguna secara langsung.",
    output_schema: null
  },
  {
    field_key: "chatbot_general",
    system_prompt: "Kamu adalah asisten AI untuk [nama aplikasi pemanggil]. Jawab dengan jelas dan profesional.",
    output_schema: null
  },
  {
    field_key: "chatbot_checkout",
    system_prompt: "Kamu adalah asisten AI untuk [nama aplikasi pemanggil]. Jawab dengan jelas dan profesional.",
    output_schema: null
  },
  {
    field_key: "reasoning_general",
    system_prompt: "Kamu adalah asisten AI untuk [nama aplikasi pemanggil]. Jawab dengan jelas dan profesional.",
    output_schema: null
  },
  {
    field_key: "orchestrator",
    system_prompt: "Kamu adalah asisten AI untuk [nama aplikasi pemanggil]. Jawab dengan jelas dan profesional.",
    output_schema: null
  }
];

db.fieldSpecs = specsToSeed;

fs.writeFileSync(dbJsonPath, JSON.stringify(db, null, 2), "utf8");
console.log("Successfully seeded local db.json with new fields, assignments, and job specs!");
