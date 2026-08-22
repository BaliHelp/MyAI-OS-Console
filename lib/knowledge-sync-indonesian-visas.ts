/**
 * Indonesian Visas — unified Knowledge Base sync
 *
 * Pulls the client's three requested sources into gw_knowledge_documents, scoped to their
 * client_app_id, so every AI surface fed by this gateway (Instagram AI, website Chat Widget,
 * MyVISA Ai) reads from one shared, regularly-refreshed source instead of three that can drift.
 *
 * Each source is upserted by (client_app_id, source_url): the existing row is replaced on every
 * run rather than accumulating duplicates, since gw_knowledge_documents has no unique constraint
 * to upsert against directly.
 */

import { supabaseAdmin } from "@/lib/supabase";

export const INDONESIAN_VISAS_CLIENT_APP_ID = "d544c3f5-89bd-4983-8387-6d85d954050f";

const VISA_PRICING_URL = "https://indonesianvisas.com/api/ai-knowledge/visa-pricing";
const KNOWLEDGE_BASE_URL = "https://indonesianvisas.com/api/ai-knowledge/knowledge-base";
const CHAT_LOGS_URL = "https://indonesianvisas.com/api/ai-knowledge/chat-logs";

interface SyncResult {
  source: string;
  success: boolean;
  bytes?: number;
  error?: string;
}

async function upsertDocument(title: string, content: string, sourceUrl: string): Promise<void> {
  if (!supabaseAdmin) throw new Error("Database not configured");

  // Replace-on-refresh: delete any existing row for this exact source before inserting the
  // fresh one, so a daily re-run updates in place instead of piling up duplicate documents
  // that would all get injected into the system prompt on every request.
  await supabaseAdmin
    .from("gw_knowledge_documents")
    .delete()
    .eq("client_app_id", INDONESIAN_VISAS_CLIENT_APP_ID)
    .eq("source_url", sourceUrl);

  const { error } = await supabaseAdmin.from("gw_knowledge_documents").insert({
    client_app_id: INDONESIAN_VISAS_CLIENT_APP_ID,
    title,
    content,
    source_url: sourceUrl,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function syncVisaPricing(): Promise<SyncResult> {
  try {
    const res = await fetch(VISA_PRICING_URL, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const lines = (data.visas || []).map((v: any) => {
      const sponsorship = v.optionalSponsorshipFee > 0
        ? ` | Sponsorship (non-eligible/Calling Visa only): IDR ${v.optionalSponsorshipFee.toLocaleString("id-ID")}`
        : "";
      return `- **${v.visaId} — ${v.visaName}** (${v.tier}): PNBP IDR ${v.visaTaxPnbp.toLocaleString("id-ID")} + Admin Fee IDR ${v.applicationAdminFee.toLocaleString("id-ID")} = **Total IDR ${v.total.toLocaleString("id-ID")}**${sponsorship}. Validity: ${v.validity}. Extendable: ${v.extendable ? "Yes" : "No"}. Requirements: ${(v.requirements || []).join(", ")}.`;
    });

    const content = `# Indonesian Visas — Live Visa Pricing\n\n_Source: ${VISA_PRICING_URL}_\n_Fetched: ${new Date().toISOString()}_\n_Upstream generatedAt: ${data.generatedAt}_\n\n${data.note || ""}\n\n${lines.join("\n")}`;

    await upsertDocument("[Live] Indonesian Visas — Visa Pricing", content, VISA_PRICING_URL);
    return { source: "visa-pricing", success: true, bytes: content.length };
  } catch (e: any) {
    return { source: "visa-pricing", success: false, error: e.message };
  }
}

async function syncKnowledgeBase(): Promise<SyncResult> {
  try {
    const res = await fetch(KNOWLEDGE_BASE_URL, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const content = await res.text();

    await upsertDocument("Indonesian Visas — FAQ & Visa Requirements", content, KNOWLEDGE_BASE_URL);
    return { source: "knowledge-base", success: true, bytes: content.length };
  } catch (e: any) {
    return { source: "knowledge-base", success: false, error: e.message };
  }
}

async function syncChatLogs(): Promise<SyncResult> {
  const token = process.env.INDONESIAN_VISAS_CHAT_LOGS_TOKEN;
  if (!token) {
    return { source: "chat-logs", success: false, error: "INDONESIAN_VISAS_CHAT_LOGS_TOKEN not configured" };
  }

  try {
    const res = await fetch(CHAT_LOGS_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const transcripts = (data.conversations || []).map((c: any) => {
      const turns = (c.messages || [])
        .map((m: any) => `[${m.role.toUpperCase()}] ${m.content}`)
        .join("\n");
      return `--- Session ${c.sessionId} (${c.createdAt}) ---\n${turns}`;
    });

    const content = `# Indonesian Visas — Real Chat Transcripts (Pattern Reference Only)\n\n_Source: ${CHAT_LOGS_URL} (${data.source})_\n_Fetched: ${new Date().toISOString()}_\n_Window: last ${data.windowDays} days, ${data.conversationCount} sessions_\n\n**IMPORTANT**: these are real conversation examples for learning tone and question patterns. Do NOT treat any specific answer below as a fixed script to repeat verbatim — always answer from the live pricing feed and the FAQ/requirements document above, not from a memorized transcript line.\n\n${transcripts.join("\n\n")}`;

    await upsertDocument("Indonesian Visas — Chat Transcripts (Reference)", content, CHAT_LOGS_URL);
    return { source: "chat-logs", success: true, bytes: content.length };
  } catch (e: any) {
    return { source: "chat-logs", success: false, error: e.message };
  }
}

export async function syncIndonesianVisasKnowledge(): Promise<SyncResult[]> {
  return Promise.all([syncVisaPricing(), syncKnowledgeBase(), syncChatLogs()]);
}
