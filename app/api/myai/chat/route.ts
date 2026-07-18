import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildMyAISystemPrompt, MyAIContext } from "@/lib/myai-context";
import fs from "fs";
import path from "path";

const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const dbJsonPath = path.resolve(projectRoot, "db.json");

function loadLocalContext(): MyAIContext {
  if (!fs.existsSync(dbJsonPath)) {
    return { apps: [], logs: [], apiKeys: [], documents: [], businessProfile: null };
  }
  const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
  return {
    apps: db.clientApps || [],
    logs: (db.usageLogs || []).slice(0, 100),
    apiKeys: db.apiKeys || [],
    documents: db.knowledgeDocuments || [],
    businessProfile: db.businessProfile || null,
  };
}

async function callOpenAI(
  messages: any[],
  systemPrompt: string,
  keyIndex: number = 1
): Promise<string> {
  const keyName = `OPENAI_API_KEY${keyIndex}`;
  const apiKey = process.env[keyName];
  if (!apiKey) throw new Error("No OpenAI key available");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callClaude(messages: any[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY1;
  if (!apiKey) throw new Error("No Claude key available");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude error ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

async function callGemini(messages: any[], systemPrompt: string): Promise<string> {
  const apiKey =
    process.env.GEMINI_API_KEY1 ||
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY2;
  if (!apiKey) throw new Error("No Gemini key available");

  // Convert message history to Gemini format
  const geminiContents = messages.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Prepend system prompt as first user message
  const allContents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Mengerti. Saya siap membantu sebagai MyAI." }] },
    ...geminiContents,
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: allContents,
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { messages = [] } = body;

    // Load real-time context
    const ctx = loadLocalContext();
    const systemPrompt = buildMyAISystemPrompt(ctx);

    let reply = "";
    let provider = "openai";

    // Cascade: OpenAI (primary) → Claude (backup 1) → Gemini (backup 2)
    try {
      reply = await callOpenAI(messages, systemPrompt, 1);
      provider = "openai";
    } catch (e1) {
      console.warn("[MyAI] OpenAI key 1 failed, trying key 2:", e1);
      try {
        reply = await callOpenAI(messages, systemPrompt, 2);
        provider = "openai2";
      } catch (e2) {
        console.warn("[MyAI] OpenAI key 2 failed, trying Claude:", e2);
        try {
          reply = await callClaude(messages, systemPrompt);
          provider = "claude";
        } catch (e3) {
          console.warn("[MyAI] Claude failed, trying Gemini:", e3);
          reply = await callGemini(messages, systemPrompt);
          provider = "gemini";
        }
      }
    }

    return NextResponse.json({ reply, provider });
  } catch (err: any) {
    console.error("[MyAI] All providers failed:", err.message);
    return NextResponse.json(
      { error: "MyAI tidak dapat merespons saat ini. Coba lagi dalam beberapa detik.", provider: "error" },
      { status: 500 }
    );
  }
}
