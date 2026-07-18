import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveToDataCenter } from "@/lib/data-center";
import fs from "fs";
import path from "path";

const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const ocrTrainingRoot = path.join(projectRoot, "public", "Knowladge OCR Training");

/**
 * Build OCR training context by listing available document categories and sample files.
 * This gives Gemini context about what kind of documents the system knows about.
 */
function buildOCRTrainingContext(documentType: string): string {
  const categoryMap: Record<string, string> = {
    passport:             "Passport",
    visa:                 "Visa",
    bank_statement:       "Bank Statement",
    flight_ticket:        "Flight Ticket",
    cv:                   "Curriculum Vita : CV",
    itinerary:            "Itinerary : Others",
    contract:             "Later Of Contract",
    accommodation:        "Proof of Accomodation",
    photo:                "Recent Photo",
    stay_permit:          "Stay Permit",
  };

  const folder = categoryMap[documentType] || documentType;
  const fullPath = path.join(ocrTrainingRoot, folder);

  let trainingFiles: string[] = [];
  if (fs.existsSync(fullPath)) {
    trainingFiles = fs.readdirSync(fullPath)
      .filter(f => !f.startsWith("."))
      .slice(0, 5); // Sample names for context
  }

  // List all categories that exist
  let allCategories: string[] = [];
  if (fs.existsSync(ocrTrainingRoot)) {
    allCategories = fs.readdirSync(ocrTrainingRoot).filter(f => !f.startsWith("."));
  }

  return `
OCR Training Context for PT Indonesian Visas Agency:
- Sistem ini dilatih untuk memproses dokumen imigrasi dan visa di Indonesia/Bali
- Kategori dokumen yang dikenal: ${allCategories.join(", ")}
- Tipe dokumen saat ini: ${documentType} (folder: ${folder})
- Contoh file pelatihan: ${trainingFiles.join(", ") || "tidak ada"}

Instruksi ekstraksi khusus berdasarkan tipe dokumen:
${getExtractionInstructions(documentType)}
`.trim();
}

function getExtractionInstructions(docType: string): string {
  const instructions: Record<string, string> = {
    passport: `
Ekstrak field berikut dari passport:
- surname (nama belakang)
- given_names (nama depan)
- nationality (kewarganegaraan)
- date_of_birth (tanggal lahir, format: DD/MM/YYYY)
- sex (jenis kelamin: M/F)
- place_of_birth (tempat lahir)
- date_of_issue (tanggal terbit)
- date_of_expiry (tanggal berakhir)
- passport_number (nomor paspor)
- issuing_country (negara penerbit)
- mrz_line1 (baris MRZ pertama jika ada)
- mrz_line2 (baris MRZ kedua jika ada)
- visa_stamps (daftar stempel visa yang terlihat)`,
    visa: `
Ekstrak field berikut dari visa:
- visa_number (nomor visa)
- visa_type (tipe visa: tourist, business, social, etc)
- country_of_issue (negara penerbit)
- valid_from (berlaku dari)
- valid_until (berlaku hingga)
- duration_of_stay (durasi tinggal)
- number_of_entries (single/multiple entry)
- passport_number (nomor paspor terkait)
- holder_name (nama pemegang)
- remarks (keterangan tambahan)`,
    bank_statement: `
Ekstrak field berikut dari bank statement:
- account_holder (nama pemegang rekening)
- bank_name (nama bank)
- account_number (nomor rekening)
- statement_period (periode laporan)
- opening_balance (saldo awal)
- closing_balance (saldo akhir)
- currency (mata uang)
- total_credits (total kredit)
- total_debits (total debet)
- average_balance (rata-rata saldo jika ada)`,
    flight_ticket: `
Ekstrak field berikut dari tiket pesawat:
- passenger_name (nama penumpang)
- flight_number (nomor penerbangan)
- departure_airport (bandara keberangkatan)
- arrival_airport (bandara tujuan)
- departure_date (tanggal berangkat)
- departure_time (waktu berangkat)
- arrival_date (tanggal tiba)
- arrival_time (waktu tiba)
- seat_number (nomor kursi)
- booking_reference (kode booking)
- ticket_class (kelas: economy/business/first)
- airline (maskapai)`,
    stay_permit: `
Ekstrak field berikut dari ijin tinggal (KITAS/KITAP):
- permit_number (nomor ijin)
- permit_type (KITAS/KITAP/ITAS/ITAP)
- holder_name (nama pemegang)
- nationality (kewarganegaraan)
- date_of_birth (tanggal lahir)
- valid_from (berlaku dari)
- valid_until (berlaku hingga)
- sponsor (sponsor/penjamin)
- purpose (tujuan tinggal)
- remarks (keterangan)`,
  };

  return instructions[docType] ||
    `Ekstrak semua informasi teks yang terlihat dan identifikasi field-field penting dalam dokumen ini. Kelompokkan informasi ke dalam kategori yang logis.`;
}

async function performOCRWithGemini(
  imageBase64: string,
  mimeType: string,
  documentType: string
): Promise<{ extracted_data: any; raw_text: string; confidence_score: number }> {
  const geminiKey =
    process.env.GEMINI_API_KEY1 ||
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY2;

  if (!geminiKey) throw new Error("Gemini API key tidak tersedia");

  // Parse data URL if needed
  let base64Data = imageBase64;
  let finalMime = mimeType;
  if (imageBase64.startsWith("data:")) {
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      finalMime = match[1];
      base64Data = match[2];
    }
  }

  const trainingContext = buildOCRTrainingContext(documentType);

  const prompt = `${trainingContext}

Kamu adalah OCR expert untuk PT Indonesian Visas Agency. Analisis dokumen ini dengan sangat teliti.

Tugas:
1. Baca semua teks yang terlihat dalam gambar/dokumen
2. Ekstrak semua field sesuai instruksi di atas
3. Tentukan confidence score (0.0 - 1.0) berdasarkan kualitas dan kelengkapan dokumen
4. Tandai jika perlu review manual (misalnya: gambar buram, data tidak jelas, dokumen tidak valid)

PENTING: Kembalikan response dalam format JSON yang valid dengan struktur:
{
  "raw_text": "semua teks yang terdeteksi dalam dokumen",
  "document_type": "${documentType}",
  "extracted_fields": {
    // semua field yang berhasil diekstrak
  },
  "confidence_score": 0.85,
  "manual_review_required": false,
  "review_reason": null,
  "language_detected": "en/id/etc",
  "warnings": []
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: finalMime.startsWith("image/") ? finalMime : "image/jpeg",
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 3000,
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini OCR error ${response.status}: ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse JSON from response
  let parsed: any = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    parsed = { raw_text: text, extracted_fields: {}, confidence_score: 0.5 };
  }

  return {
    extracted_data: {
      document_type: documentType,
      ...parsed,
    },
    raw_text: parsed.raw_text || text,
    confidence_score: typeof parsed.confidence_score === "number" ? parsed.confidence_score : 0.8,
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      file,         // base64 data URL
      fileMimeType, // image/jpeg, image/png, application/pdf, etc.
      documentType, // passport, visa, bank_statement, etc.
      clientAppId,  // optional app association
      tags,         // optional tags
    } = body;

    if (!file) {
      return NextResponse.json({ error: "File diperlukan (base64)" }, { status: 400 });
    }

    const docType = documentType || "manual_document";

    // Perform OCR
    const ocrResult = await performOCRWithGemini(file, fileMimeType || "image/jpeg", docType);

    // Save to Data Center
    const dataCenterId = await saveToDataCenter({
      client_app_id: clientAppId || null,
      field_key: docType,
      source_type: "ocr_upload",
      document_type: docType,
      extracted_data: ocrResult.extracted_data,
      raw_text: ocrResult.raw_text,
      language: ocrResult.extracted_data?.language_detected || "en",
      tags: tags || [docType, "ocr_scan"],
      fileBase64: file,
      fileMimeType: fileMimeType || "image/jpeg",
      manual_review_required: ocrResult.extracted_data?.manual_review_required ?? false,
      confidence_score: ocrResult.confidence_score,
    });

    return NextResponse.json({
      success: true,
      data_center_id: dataCenterId,
      ocr_result: ocrResult,
    }, { status: 201 });

  } catch (err: any) {
    console.error("[OCR scan] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "Gagal melakukan OCR scan" },
      { status: 500 }
    );
  }
}
