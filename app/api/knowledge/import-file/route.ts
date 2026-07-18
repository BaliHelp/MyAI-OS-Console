import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const dbJsonPath = path.resolve(projectRoot, "db.json");

function parseFileContent(content: string, mimeType: string, fileName: string): { title: string; text: string } {
  const name = fileName.replace(/\.[^.]+$/, "");
  let text = "";

  if (mimeType === "application/json" || fileName.endsWith(".json")) {
    try {
      const parsed = JSON.parse(content);
      // If array of objects, extract all text values
      if (Array.isArray(parsed)) {
        text = parsed.map((item: any) =>
          typeof item === "string" ? item : JSON.stringify(item, null, 2)
        ).join("\n\n");
      } else {
        text = JSON.stringify(parsed, null, 2);
      }
    } catch {
      text = content;
    }
  } else if (mimeType === "text/csv" || fileName.endsWith(".csv")) {
    // Parse CSV: convert to readable table format
    const lines = content.split("\n").filter(Boolean);
    if (lines.length > 0) {
      const headers = lines[0].split(",").map((h: string) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map((line: string) => {
        const cols = line.split(",").map((c: string) => c.trim().replace(/^"|"$/g, ""));
        return headers.map((h: string, i: number) => `${h}: ${cols[i] || ""}`).join(" | ");
      });
      text = `Headers: ${headers.join(", ")}\n\n${rows.join("\n")}`;
    }
  } else {
    // Plain text
    text = content;
  }

  return { title: name, text };
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { content, fileName, mimeType, clientAppId } = body;

    if (!content || !fileName) {
      return NextResponse.json({ error: "content dan fileName diperlukan" }, { status: 400 });
    }

    const { title, text } = parseFileContent(content, mimeType || "text/plain", fileName);

    const recordId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newDoc = {
      id: recordId,
      client_app_id: clientAppId || null,
      title: `[Import] ${title}`,
      content: text,
      created_at: now,
    };

    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from("gw_knowledge_documents")
        .insert(newDoc);
      if (error) throw new Error(error.message);
    } else {
      // Local fallback
      if (fs.existsSync(dbJsonPath)) {
        const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
        if (!db.knowledgeDocuments) db.knowledgeDocuments = [];
        db.knowledgeDocuments.push(newDoc);
        fs.writeFileSync(dbJsonPath, JSON.stringify(db, null, 2), "utf8");
      }
    }

    return NextResponse.json({ success: true, document: newDoc }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal mengimpor file" }, { status: 500 });
  }
}
