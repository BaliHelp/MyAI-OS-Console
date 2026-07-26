/**
 * Seed Official Indonesian Visas Knowledge Base
 * Populates gw_knowledge_documents with comprehensive visa catalog, pricing,
 * requirements, and extension procedures.
 *
 * Usage: npx tsx scripts/seed-visa-knowledge.ts
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Read .env.local manually
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!(globalThis as any).WebSocket) {
  (globalThis as any).WebSocket = class {};
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

// Indonesian Visas App ID
const IV_CLIENT_APP_ID = "d544c3f5-89bd-4983-8387-6d85d954050f";

const VISA_KNOWLEDGE_DOCS = [
  {
    title: "Katalog Visa Indonesia & Daftar Harga Resmi (PT Indonesian Visas Agency)",
    content: `
Katalog Resmi Jenis Visa Indonesia & Biaya Layanan:

1. Visa Kunjungan Wisata / Bisnis Single Entry (B211A / C1 / C2):
- Masa Berlaku: 60 hari (dapat diperpanjang hingga 2x, masing-masing 60 hari, total 180 hari).
- Harga Standar (Reguler 3-5 hari kerja): IDR 2.700.000 (sekitar USD 175)
- Harga Express (1-2 hari kerja): IDR 3.800.000 (sekitar USD 245)
- Kegunaan: Wisata, pertemuan bisnis, kunjungan keluarga, pameran non-komersial.

2. Visa On Arrival (VOA) / e-VOA (B1):
- Masa Berlaku: 30 hari (dapat diperpanjang 1x 30 hari).
- Harga Resmi Imigrasi: IDR 500.000 (sekitar USD 35)
- Biaya Perpanjangan VOA via Agency: IDR 850.000 - 1.000.000

3. Multiple Entry Visit Visa (D1 / D2 - 1 Tahun & 2 Tahun):
- Masa Berlaku: 1 atau 2 tahun (tiap kali masuk Indonesia maksimal stay 60 hari).
- Harga 1 Tahun: IDR 4.500.000 (sekitar USD 290)
- Harga 2 Tahun: IDR 7.500.000 (sekitar USD 485)
- Kegunaan: Pebisnis atau wisatawan yang sering keluar-masuk Indonesia.

4. Investor KITAS (E28A - 2 Tahun):
- Masa Berlaku: 2 Tahun.
- Harga Paket Lengkap: IDR 18.000.000 - 22.000.000
- Persyaratan: Kepemilikan saham PT PMA minimal IDR 10 Miliar.

5. Working KITAS (E23 - 1 Tahun):
- Masa Berlaku: 12 Bulan.
- Harga Paket Lengkap: IDR 25.000.000 (termasuk DKP-TKA USD 1.200 / tahun).

6. Golden Visa Indonesia (5 - 10 Tahun):
- Masa Berlaku: 5 atau 10 tahun.
- Kategori: Investor Individu, Perusahaan, Diaspora, atau Talent Berprestasi.
`.trim(),
  },
  {
    title: "Persyaratan Dokumen & Prosedur Pengajuan Visa Indonesia",
    content: `
Persyaratan Utama Pengajuan Visa Indonesia di PT Indonesian Visas Agency:

1. Paspor Asli / Scan Halaman Bio Paspor:
- Paspor harus berlaku minimal 6 bulan saat pengajuan (minimal 12 bulan untuk KITAS).
- Halaman bio paspor harus terlihat jelas tanpa pantulan cahaya.

2. Pas Foto Terbaru:
- Foto latar belakang putih/terang, pakaian rapi, wajah terlihat jelas.

3. Rekening Bank (Proof of Funds):
- Rekening bank atas nama pemohon dengan saldo minimal USD 2.000 (atau setara Rp 32.000.000) untuk visa B211A/C1.

4. Tiket Keluar / Tiket Kembali (Return Ticket):
- Bukti tiket penerbangan meninggalkan wilayah Indonesia.

5. Garansi Sponsor:
- PT Indonesian Visas Agency menyediakan penjaminan sponsor resmi untuk visa B211A/C1 dan perpanjangan stay permit di Bali/Indonesia.
`.trim(),
  },
  {
    title: "Prosedur Perpanjangan Visa & Aturan Overstay Imigrasi Bali",
    content: `
Prosedur Perpanjangan Visa & Aturan Resmi Imigrasi:

1. Waktu Pengajuan Perpanjangan:
- Sebaiknya diajukan 7-14 hari sebelum masa berlaku visa saat ini habis.

2. Prosedur Biometrik di Kantor Imigrasi (Ngurah Rai / Denpasar / Singaraja):
- Pemohon wajib datang 1 kali ke kantor imigrasi untuk foto biometrik dan pengambilan sidik jari.
- Tim Indonesian Visas akan mendampingi proses di kantor imigrasi.

3. Denda Overstay Resmi Imigrasi Indonesia:
- Denda overstay adalah IDR 1.000.000 per hari (sesuai UU Imigrasi No. 6 Tahun 2011).
- Jika overstay lebih dari 60 hari, pemohon dapat dikenakan sanksi deportasi dan penangkalan (blacklisting).
`.trim(),
  },
];

async function seedVisaKnowledge() {
  console.log("==========================================================");
  console.log("🌱 Seeding Official Indonesian Visas Knowledge Base");
  console.log("==========================================================\n");

  let successCount = 0;

  for (const doc of VISA_KNOWLEDGE_DOCS) {
    try {
      const { error } = await supabase.from("gw_knowledge_documents").insert({
        client_app_id: IV_CLIENT_APP_ID,
        title: doc.title,
        content: doc.content,
      });

      if (error) {
        console.warn(`⚠️ Warning inserting "${doc.title}":`, error.message);
      } else {
        successCount++;
        console.log(`✅ Successfully seeded: "${doc.title}"`);
      }
    } catch (err: any) {
      console.error(`❌ Error inserting "${doc.title}":`, err?.message);
    }
  }

  console.log("\n==========================================================");
  console.log(`🎉 Visa Knowledge Seeding Complete! (${successCount}/${VISA_KNOWLEDGE_DOCS.length} inserted)`);
  console.log("==========================================================");
}

seedVisaKnowledge().catch(console.error);
