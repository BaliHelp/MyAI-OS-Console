// Backfill sekali-jalan: buat embedding untuk record gw_data_center lama (sebelum fitur ini
// ada). Record baru otomatis di-embed saat dibuat (lihat lib/data-center.ts). Hanya record
// dengan raw_text yang di-embed — record tanpa teks (mis. upload gambar tanpa OCR) dilewati.
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const file = fs.readFileSync(envPath, "utf8");
  file.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  });
}

async function main() {
  const { supabaseAdmin } = await import("../lib/supabase");
  const { embedText } = await import("../lib/embedding-adapters/gemini-embedding");

  if (!supabaseAdmin) {
    console.error("Supabase admin tidak terkonfigurasi");
    process.exit(1);
  }

  const { data: records, error } = await supabaseAdmin
    .from("gw_data_center")
    .select("id, raw_text")
    .is("embedding", null)
    .not("raw_text", "is", null);

  if (error) {
    console.error("Gagal mengambil data:", error);
    process.exit(1);
  }

  const withText = (records as Array<{ id: string; raw_text: string }>).filter((r) => r.raw_text?.trim());
  console.log(`Backfill ${withText.length} record (dari ${records.length} yang belum ada embedding, sisanya tanpa raw_text)...\n`);

  let ok = 0, failed = 0;
  for (const rec of withText) {
    const embedding = await embedText(rec.raw_text);
    if (!embedding) {
      console.log(`❌ ${rec.id} — embedding gagal`);
      failed++;
      continue;
    }
    const { error: updateError } = await supabaseAdmin
      .from("gw_data_center")
      .update({ embedding })
      .eq("id", rec.id);
    if (updateError) {
      console.log(`❌ ${rec.id} — update gagal: ${updateError.message}`);
      failed++;
    } else {
      console.log(`✅ ${rec.id}`);
      ok++;
    }
  }

  console.log(`\n${ok} berhasil, ${failed} gagal, dari ${withText.length} total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
