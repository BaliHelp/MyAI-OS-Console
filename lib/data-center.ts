import { supabaseAdmin } from "./supabase";
import sharp from "sharp";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Fallback to local db.json when Supabase is not ready
const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const dbJsonPath = path.resolve(projectRoot, "db.json");

export interface DataCenterRecordInput {
  client_app_id?: string | null;
  field_key?: string | null;
  source_type: 'ocr_upload' | 'url_scrape' | 'manual_document' | 'chat_memory_fact';
  source_url?: string | null;
  document_type?: string | null;
  extracted_data?: any;
  raw_text?: string | null;
  language?: string | null;
  tags?: string[] | null;
  fileBase64?: string | null; // e.g. raw base64 or data URL
  fileMimeType?: string | null;
  manual_review_required?: boolean;
  confidence_score?: number | null;
}

/**
 * Process uploaded file and insert record into gw_data_center.
 * Automatically converts images to WebP via sharp at 80% quality.
 */
export async function saveToDataCenter(input: DataCenterRecordInput): Promise<string | null> {
  let fileUrl: string | null = null;

  // 1. Process and upload file if provided
  if (input.fileBase64) {
    try {
      let base64Data = input.fileBase64;
      let mimeType = input.fileMimeType || "image/jpeg";

      // If data URL, parse it
      if (base64Data.startsWith("data:")) {
        const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
        if (matches && matches.length >= 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      let buffer = Buffer.from(base64Data, "base64");
      let ext = "jpeg";
      if (mimeType.includes("png")) ext = "png";
      else if (mimeType.includes("webp")) ext = "webp";
      else if (mimeType.includes("pdf")) ext = "pdf";

      // If it is an image, convert to WebP at 80% quality using sharp (excluding PDFs)
      const isImage = mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "heic", "webp"].includes(ext);
      if (isImage && ext !== "pdf") {
        buffer = await sharp(buffer)
          .webp({ quality: 80 })
          .toBuffer();
        mimeType = "image/webp";
        ext = "webp";
      }

      // Upload to Supabase Storage
      if (supabaseAdmin) {
        const folder1 = input.client_app_id || "internal";
        const folder2 = input.field_key || input.source_type;
        const fileUuid = crypto.randomUUID();
        const pathPattern = `${folder1}/${folder2}/${fileUuid}.${ext}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("data-center-files")
          .upload(pathPattern, buffer, {
            contentType: mimeType,
            cacheControl: "3600",
            upsert: true
          });

        if (uploadError) {
          console.error("[data-center] Storage upload error:", uploadError.message);
        } else {
          fileUrl = pathPattern;
          console.log(`[data-center] Uploaded file to Supabase storage: ${pathPattern}`);
        }
      } else {
        // Local db.json fallback file write
        const fileUuid = crypto.randomUUID();
        const localDir = path.resolve(projectRoot, "public/uploads");
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        const localPath = path.join(localDir, `${fileUuid}.${ext}`);
        fs.writeFileSync(localPath, buffer);
        fileUrl = `/uploads/${fileUuid}.${ext}`;
        console.log(`[data-center] Fallback write local file: ${fileUrl}`);
      }
    } catch (err: any) {
      console.error("[data-center] Error in file processing pipeline:", err.message);
    }
  }

  const recordId = crypto.randomUUID();
  const documentType = input.document_type || input.extracted_data?.document_type || null;
  const manualReview = input.manual_review_required ?? (input.extracted_data?.manual_review_required ?? false);
  const confidence = input.confidence_score ?? (input.extracted_data?.confidence_score ?? null);

  // 2. Insert into Database
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("gw_data_center")
      .insert({
        id: recordId,
        client_app_id: input.client_app_id || null,
        field_key: input.field_key || null,
        source_type: input.source_type,
        source_url: input.source_url || null,
        document_type: documentType,
        extracted_data: input.extracted_data || null,
        raw_text: input.raw_text || null,
        language: input.language || null,
        tags: input.tags || null,
        file_url: fileUrl,
        manual_review_required: manualReview,
        confidence_score: confidence,
        created_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (error) {
      console.error("[data-center] DB Insert error:", error.message);
      return null;
    }
    return data?.id || recordId;
  } else {
    // Local JSON DB fallback
    if (fs.existsSync(dbJsonPath)) {
      const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
      if (!db.dataCenter) db.dataCenter = [];
      
      const newRecord = {
        id: recordId,
        client_app_id: input.client_app_id || null,
        field_key: input.field_key || null,
        source_type: input.source_type,
        source_url: input.source_url || null,
        document_type: documentType,
        extracted_data: input.extracted_data || null,
        raw_text: input.raw_text || null,
        language: input.language || null,
        tags: input.tags || null,
        file_url: fileUrl,
        manual_review_required: manualReview,
        confidence_score: confidence,
        created_at: new Date().toISOString()
      };

      db.dataCenter.push(newRecord);
      fs.writeFileSync(dbJsonPath, JSON.stringify(db, null, 2), "utf8");
      console.log(`[data-center] Saved local fallback record: ${recordId}`);
      return recordId;
    }
  }

  return null;
}

/**
 * Generate a signed URL for a file in private data-center-files bucket (valid for 1 hour).
 */
export async function getSignedUrl(filePath: string): Promise<string> {
  if (!filePath) return "";
  
  // If it's a local fallback file
  if (filePath.startsWith("/uploads/")) {
    return filePath;
  }

  if (!supabaseAdmin) {
    return filePath;
  }

  const { data, error } = await supabaseAdmin.storage
    .from("data-center-files")
    .createSignedUrl(filePath, 3600); // 1 hour

  if (error) {
    console.error("[data-center] Error generating signed URL:", error.message);
    return "";
  }

  return data?.signedUrl || "";
}
