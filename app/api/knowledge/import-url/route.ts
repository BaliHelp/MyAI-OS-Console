import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const dbJsonPath = path.resolve(projectRoot, "db.json");

async function fetchAndExtractContent(url: string): Promise<{ title: string; content: string }> {
  // Fetch raw HTML
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Gagal mengakses URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Simple but effective HTML to text extraction
  // Remove scripts, styles, nav, footer
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : url;

  // Limit to 15,000 chars to prevent token overflow
  const content = cleaned.substring(0, 15000);

  // Now use Gemini to summarize and structure the content
  const geminiKey =
    process.env.GEMINI_API_KEY1 ||
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY2;

  let finalContent = content;

  if (geminiKey && content.length > 500) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Kamu adalah asisten ekstraksi pengetahuan. Baca konten website berikut dan ekstrak SEMUA informasi penting dalam format yang terstruktur dan mudah dibaca. Jangan ringkas — ambil semua fakta, data, layanan, harga, kontak, alamat, prosedur, dan informasi lain yang berguna. Tulis dalam Bahasa Indonesia jika memungkinkan.\n\nURL: ${url}\nJudul: ${rawTitle}\n\nKonten:\n${content}`,
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 4000,
              temperature: 0.1,
            },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const extracted = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (extracted) {
          finalContent = `Sumber: ${url}\n\n${extracted}`;
        }
      }
    } catch (e) {
      console.warn("[import-url] Gemini extraction failed, using raw text:", e);
      finalContent = `Sumber: ${url}\n\n${content}`;
    }
  } else {
    finalContent = `Sumber: ${url}\n\n${content}`;
  }

  return { title: rawTitle, content: finalContent };
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { url, clientAppId } = body;

    if (!url) {
      return NextResponse.json({ error: "URL diperlukan" }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL tidak valid" }, { status: 400 });
    }

    const { title, content } = await fetchAndExtractContent(url);

    const recordId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newDoc = {
      id: recordId,
      client_app_id: clientAppId || null,
      title: `[URL] ${title || parsedUrl.hostname}`,
      content,
      source_url: url,
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
    return NextResponse.json(
      { error: err.message || "Gagal mengimpor URL" },
      { status: 500 }
    );
  }
}
