import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

/**
 * POST /api/data-center/ingest
 * Public endpoint authenticated via gateway Bearer key.
 * Called by client apps (Indonesian Visas, Tropic Tech, AiChat, etc.)
 * to push their data into MyAI OS central Data Center.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || "";
  const bearerKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!bearerKey) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Data center unavailable" }, { status: 503 });
  }

  const keyHash = crypto.createHash("sha256").update(bearerKey).digest("hex");
  const { data: allKeys } = await supabaseAdmin
    .from("gw_api_keys")
    .select("id, client_app_id, status, key_hash")
    .eq("status", "active");

  const keyRow = (allKeys || []).find(
    (k: any) => k.key_hash === keyHash || k.key_hash === bearerKey
  );

  if (!keyRow) {
    return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
  }

  let resolvedClientAppId: string | null = keyRow.client_app_id || null;

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { source_app, event_type, data: payload, metadata = {} } = body;

  if (!event_type || !payload) {
    return NextResponse.json({ error: "event_type and data are required" }, { status: 400 });
  }

  if (!resolvedClientAppId && source_app) {
    const { data: appRow } = await supabaseAdmin
      .from("gw_client_apps")
      .select("id")
      .eq("slug", source_app)
      .maybeSingle();
    resolvedClientAppId = appRow?.id || null;
  }

  const SOURCE_TYPE_MAP: Record<string, string> = {
    ocr_scan: "ocr_upload",
    chat_interaction: "chatbot_interaction",
    email_classification: "chat_memory_fact",
    user_action: "manual_document",
    content_generation: "content_generation",
  };
  const sourceType = SOURCE_TYPE_MAP[event_type] || "manual_document";

  const rawText: string =
    metadata.raw_text ||
    (event_type === "chat_interaction"
      ? `[CHAT] User: ${payload.user_message || ""} | AI: ${(payload.ai_response || "").slice(0, 400)}`
      : event_type === "email_classification"
      ? `[EMAIL] Subject: ${payload.subject || ""} | Class: ${JSON.stringify(payload.classification || {})}`
      : event_type === "ocr_scan"
      ? `[OCR] ${payload.documentType || payload.document_type || "Document"}: ${payload.fullName || payload.full_name || payload.passengerName || ""} ${payload.passportNumber || payload.document_number || ""}`.trim()
      : Object.entries(payload)
          .filter(([, v]) => v && typeof v !== "object")
          .map(([k, v]) => `${k}: ${v}`)
          .slice(0, 20)
          .join(" | "));

  const recordId = crypto.randomUUID();
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("gw_data_center")
    .insert({
      id: recordId,
      client_app_id: resolvedClientAppId,
      field_key: metadata.field_key || event_type,
      source_type: sourceType,
      source_url: metadata.session_id ? `session:${metadata.session_id}` : null,
      document_type: metadata.document_type || payload.documentType || payload.document_type || null,
      extracted_data: payload,
      raw_text: rawText || null,
      language: metadata.language || "en",
      tags: [
        source_app || "unknown-app",
        event_type,
        ...(metadata.tags || []),
        ...(metadata.document_type ? [metadata.document_type] : []),
      ],
      file_url: payload.fileUrl || payload.file_url || null,
      manual_review_required: false,
      confidence_score: metadata.confidence ?? payload.confidence ?? payload.confidence_score ?? null,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[data-center/ingest] Insert error:", insertError.message);
    return NextResponse.json({ error: "Failed to store record" }, { status: 500 });
  }

  supabaseAdmin
    .from("gw_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  console.log(`[data-center/ingest] OK ${recordId} | app=${source_app || resolvedClientAppId} event=${event_type}`);

  return NextResponse.json(
    { success: true, id: inserted?.id || recordId, stored_as: { source_type: sourceType, client_app_id: resolvedClientAppId } },
    { status: 201 }
  );
}
