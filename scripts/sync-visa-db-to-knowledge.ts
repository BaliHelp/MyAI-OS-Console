/**
 * Sync Official Visa Database Admin Dashboard to MyAI OS Knowledge Base
 * Reads all detailed visa products from Indonesian Visas database (Visa model)
 * and syncs them into gw_knowledge_documents in Supabase.
 *
 * Usage: npx tsx scripts/sync-visa-db-to-knowledge.ts
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "/Users/bayu_1/Documents/ANTIGRAVITY/IndonesianVisas/node_modules/@prisma/client";
import fs from "fs";
import path from "path";

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

// IV Supabase Database URL
const ivDbUrl = "postgresql://postgres.thvdfcogdxmqipybqzot:%40%23lacunacoilflames@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const prisma = new PrismaClient({ datasources: { db: { url: ivDbUrl } } });

// Target Client App ID for Indonesian Visas
const IV_CLIENT_APP_ID = "d544c3f5-89bd-4983-8387-6d85d954050f";

async function main() {
  console.log("==========================================================");
  console.log("🚀 Syncing Visa Database Admin Dashboard to MyAI OS");
  console.log("==========================================================\n");

  const visaRows = await prisma.visa.findMany({
    orderBy: { category: "asc" },
  });

  console.log(`📦 Found ${visaRows.length} detailed visa entries in Admin Dashboard Database.`);

  if (visaRows.length === 0) {
    console.log("⚠️ No rows found in Visa table. Exiting.");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  // Format all visa rows into structured Markdown documents
  for (const visa of visaRows) {
    let parsedDetails: any = {};
    try {
      if (typeof visa.details === "string" && visa.details.trim().startsWith("{")) {
        parsedDetails = JSON.parse(visa.details);
      } else if (typeof visa.details === "object") {
        parsedDetails = visa.details;
      }
    } catch {}

    const title = `Dokumen Resmi Visa Database Admin Dashboard - ${visa.name} (${visa.category.toUpperCase()})`;
    const content = `
=== DOKUMEN RESMI VISA DATABASE ADMIN DASHBOARD ===
- Nama Visa: ${visa.name}
- Kategori Visa: ${visa.category}
- Harga Resmi (Base Price): ${visa.price}
- Biaya Layanan / Service Fee: ${visa.fee}
- Biaya Garansi Sponsor: ${visa.sponsorship}
- Masa Berlaku (Validity): ${visa.validity}
- Perpanjangan (Extendable): ${visa.extendable ? "Ya (Dapat Diperpanjang)" : "Tidak (Single Stay)"}
- Deskripsi: ${visa.description}
- Persyaratan Dokumen:
${visa.requirements}

- Detail Tambahan Admin:
${JSON.stringify(parsedDetails, null, 2)}
===================================================
`.trim();

    try {
      const { error } = await supabase.from("gw_knowledge_documents").insert({
        client_app_id: IV_CLIENT_APP_ID,
        title: title,
        content: content,
      });

      if (error) {
        console.warn(`  ⚠️ Error inserting ${visa.name}:`, error.message);
        errorCount++;
      } else {
        successCount++;
        console.log(`  ✅ Synced: ${visa.name} (${visa.category}) - Price: ${visa.price}, Fee: ${visa.fee}`);
      }
    } catch (err: any) {
      errorCount++;
      console.warn(`  ⚠️ Exception inserting ${visa.name}:`, err?.message);
    }
  }

  console.log("\n==========================================================");
  console.log(`🎉 Visa Database Admin Sync Complete! (${successCount} synced, ${errorCount} errors)`);
  console.log("==========================================================");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
