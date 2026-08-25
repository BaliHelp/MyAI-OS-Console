// One-off backfill: generate embeddings for gw_knowledge_documents rows created before
// embedding support existed (see supabase/migrations/20260826200000_knowledge_documents_embeddings.sql
// and lib/knowledge.ts). New documents get their embedding automatically on creation — this
// script only needs to run once for the pre-existing backlog.
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
    console.error("Supabase admin not configured");
    process.exit(1);
  }

  const { data: docs, error } = await supabaseAdmin
    .from("gw_knowledge_documents")
    .select("id, title, content")
    .is("embedding", null);

  if (error) {
    console.error("Error fetching documents:", error);
    process.exit(1);
  }

  console.log(`Backfilling ${docs.length} document(s) with no embedding yet...\n`);

  let ok = 0, failed = 0;
  for (const doc of docs as Array<{ id: string; title: string; content: string }>) {
    const embedding = await embedText(doc.content);
    if (!embedding) {
      console.log(`❌ ${doc.title} — embedding failed`);
      failed++;
      continue;
    }
    const { error: updateError } = await supabaseAdmin
      .from("gw_knowledge_documents")
      .update({ embedding })
      .eq("id", doc.id);
    if (updateError) {
      console.log(`❌ ${doc.title} — update failed: ${updateError.message}`);
      failed++;
    } else {
      console.log(`✅ ${doc.title}`);
      ok++;
    }
  }

  console.log(`\n${ok} succeeded, ${failed} failed, out of ${docs.length} total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
