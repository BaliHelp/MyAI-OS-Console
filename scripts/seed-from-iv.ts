/**
 * Master Data Center Batch Seeding Script
 * Directly imports historical OCR scan records and AI logs from Indonesian Visas
 * database into MyAI OS central gw_data_center repository.
 *
 * Usage: npx tsx scripts/seed-from-iv.ts
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "/Users/bayu_1/Documents/ANTIGRAVITY/IndonesianVisas/node_modules/@prisma/client";
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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});


// IV Supabase Database URL
const ivDbUrl = "postgresql://postgres.thvdfcogdxmqipybqzot:%40%23lacunacoilflames@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const prisma = new PrismaClient({ datasources: { db: { url: ivDbUrl } } });

// Target Client App ID for Indonesian Visas
const IV_CLIENT_APP_ID = "d544c3f5-89bd-4983-8387-6d85d954050f";

async function main() {
  console.log("==========================================================");
  console.log("🚀 Starting Direct Batch Seeding into MyAI OS gw_data_center");
  console.log("==========================================================\n");

  let dcSuccess = 0;
  let dcError = 0;
  let aiSuccess = 0;
  let aiError = 0;

  // 1. Seed historical DataCenter records (OCR Scans)
  try {
    const dcRecords = await prisma.dataCenter.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    console.log(`📦 Found ${dcRecords.length} historical DataCenter records in Indonesian Visas database.`);

    for (const record of dcRecords) {
      try {
        const recordId = crypto.randomUUID();
        const extracted = typeof record.extractedData === "object" && record.extractedData ? record.extractedData : {};
        const rawText = record.rawText || Object.entries(extracted)
          .filter(([, v]) => v && typeof v !== "object")
          .map(([k, v]) => `- **${k}**: ${v}`)
          .join("\n") || `[OCR SCAN] Document: ${record.documentType}`;

        const { error } = await supabase.from("gw_data_center").insert({
          id: recordId,
          client_app_id: IV_CLIENT_APP_ID,
          field_key: "ocr_id_document",
          source_type: "ocr_upload",
          source_url: record.sessionKey ? `session:${record.sessionKey}` : null,
          document_type: record.documentType,
          extracted_data: extracted,
          raw_text: rawText,
          language: "en",
          tags: ["indonesian-visas", "historical_seed", record.documentType],
          manual_review_required: record.manualReviewReq ?? false,
          created_at: record.createdAt.toISOString(),
        });

        if (error) {
          dcError++;
          console.warn(`  ⚠️ Error inserting record ${record.id}:`, error.message);
        } else {
          dcSuccess++;
        }
      } catch (err: any) {
        dcError++;
      }
    }
  } catch (err: any) {
    console.error("❌ Error querying IV DataCenter:", err?.message);
  }

  // 2. Seed historical AILog records (Chatbot/Reasoning interactions)
  try {
    const aiLogs = await prisma.aILog.findMany({
      where: { status: "success" },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    console.log(`\n💬 Found ${aiLogs.length} historical AILog records in Indonesian Visas database.`);

    for (const log of aiLogs) {
      try {
        const recordId = crypto.randomUUID();
        const isChat = (log.feature || "").includes("chat") || (log.action || "").includes("chat");
        const sourceType = isChat ? "chatbot_interaction" : "chat_memory_fact";

        const { error } = await supabase.from("gw_data_center").insert({
          id: recordId,
          client_app_id: IV_CLIENT_APP_ID,
          field_key: log.feature || "chat",
          source_type: sourceType,
          document_type: isChat ? "chat" : "reasoning",
          extracted_data: {
            action: log.action,
            feature: log.feature,
            provider: log.provider,
            model: log.model,
            details: log.details,
            tokensIn: log.tokensIn,
            tokensOut: log.tokensOut,
            latencyMs: log.latencyMs,
          },
          raw_text: `- **ACTION**: ${log.action}\n- **FEATURE**: ${log.feature || "general"}\n- **PROVIDER**: ${log.provider || "myai-os"}\n- **MODEL**: ${log.model || "unknown"}\n- **DETAILS**: ${JSON.stringify(log.details || {})}`,
          language: "auto",
          tags: ["indonesian-visas", "historical_seed", log.provider || "ai"],
          created_at: log.createdAt.toISOString(),
        });

        if (error) {
          aiError++;
        } else {
          aiSuccess++;
        }
      } catch (err: any) {
        aiError++;
      }
    }
  } catch (err: any) {
    console.error("❌ Error querying IV AILog:", err?.message);
  }

  console.log("\n==========================================================");
  console.log("🎉 Batch Seeding Complete!");
  console.log(`   OCR Scan Records: ${dcSuccess} inserted successfully, ${dcError} errors`);
  console.log(`   AI Interaction Logs: ${aiSuccess} inserted successfully, ${aiError} errors`);
  console.log("==========================================================");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
