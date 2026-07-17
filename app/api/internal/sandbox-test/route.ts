import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { attemptCall } from "@/app/api/v1/chat/completions/route";
import { decryptKey } from "@/lib/crypto";
import { parseUploadedFile, type ParsedFileResult } from "@/lib/file-parser";
import fs from "fs";
import path from "path";

const dbJsonPath = path.resolve(process.cwd(), "db.json");

export async function POST(req: NextRequest) {
  // 1. Enforce Admin Session Authorization Check (Session cookie-based)
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized: Admin session required" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const fieldKey = body.field || body.field_key;
    const prompt = body.prompt;

    if (!fieldKey || !prompt) {
      return NextResponse.json({ error: "field and prompt are required" }, { status: 400 });
    }

    // 2. Fetch Field Spec for System Prompt & Output Schema
    let fieldSpec: any = null;
    let isSupabaseReady = !!supabaseAdmin;

    if (isSupabaseReady) {
      try {
        const { data: specData } = await supabaseAdmin!
          .from("gw_field_specs")
          .select("system_prompt, output_schema")
          .eq("field_key", fieldKey)
          .maybeSingle();

        if (specData) {
          fieldSpec = specData;
        }
      } catch (err) {
        console.warn("[sandbox] Database error fetching field spec, falling back to local json:", err);
      }
    }

    if (!fieldSpec) {
      try {
        if (fs.existsSync(dbJsonPath)) {
          const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
          fieldSpec = (db.fieldSpecs || []).find((s: any) => s.field_key === fieldKey);
        }
      } catch (err) {
        console.error("[sandbox] Failed to load local fieldSpecs fallback:", err);
      }
    }

    // 3. Resolve system prompt and dynamic variables
    let resolvedSystemPrompt = "";
    const appName = "Internal Sandbox";

    if (fieldSpec) {
      const rawPrompt = fieldSpec.system_prompt || "Kamu adalah asisten AI untuk [nama aplikasi pemanggil]. Jawab dengan jelas dan profesional.";
      resolvedSystemPrompt = rawPrompt.replace(/\[nama aplikasi pemanggil\]/g, appName);

      if (fieldSpec.output_schema) {
        const schemaStr = typeof fieldSpec.output_schema === "string" 
          ? fieldSpec.output_schema 
          : JSON.stringify(fieldSpec.output_schema);
        resolvedSystemPrompt += `\n\nKamu WAJIB merespons HANYA dengan objek JSON yang valid sesuai skema ini, tanpa teks lain: ${schemaStr}`;
      }
    } else {
      resolvedSystemPrompt = `You are a helpful AI assistant for "${appName}". Jawab dengan jelas dan profesional.`;
    }

    const systemPrompt = resolvedSystemPrompt;

    // 4. Retrieve routing assignments
    let assignments: any[] = [];
    if (isSupabaseReady) {
      try {
        const { data: dbAsns } = await supabaseAdmin!
          .from("gw_field_pool_assignments")
          .select("provider, pool_tier")
          .eq("field_key", fieldKey)
          .order("pool_tier", { ascending: true });
        
        if (dbAsns && dbAsns.length > 0) {
          assignments = dbAsns;
        }
      } catch (err) {
        console.warn("[sandbox] Database error fetching pool assignments, falling back:", err);
      }
    }

    if (assignments.length === 0) {
      try {
        if (fs.existsSync(dbJsonPath)) {
          const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
          assignments = (db.fieldPoolAssignments || [])
            .filter((a: any) => a.field_key === fieldKey)
            .map((a: any) => ({ provider: a.provider, pool_tier: a.pool_tier }))
            .sort((a: any, b: any) => a.pool_tier - b.pool_tier);
        }
      } catch (err) {
        console.error("[sandbox] Failed to load local assignments fallback:", err);
      }
    }

    if (assignments.length === 0) {
      return NextResponse.json(
        { error: `No active pool assignments configured for field: ${fieldKey}` },
        { status: 400 }
      );
    }

    // 5. Deteksi dan parsing semua tipe file yang diunggah
    const fileBase64 = body.file || body.image;
    let uploadedFile: ParsedFileResult | null = null;

    if (fileBase64) {
      uploadedFile = await parseUploadedFile(fileBase64);

      if (uploadedFile.category === "unsupported") {
        return NextResponse.json({ error: uploadedFile.error }, { status: 400 });
      }
    }

    // Kompatibilitas backward: parsedFile untuk vision pipeline
    const parsedFile = uploadedFile?.imageData ? {
      mimeType: uploadedFile.imageData.mimeType,
      base64Data: uploadedFile.imageData.base64Data
    } : null;

    // Injeksi konten dokumen untuk tipe teks (PDF-text, DOCX, CSV, TXT)
    let effectivePrompt = prompt;
    if (uploadedFile?.extractedText) {
      effectivePrompt = `--- ISI DOKUMEN (${uploadedFile.originalMimeType}) ---
${uploadedFile.extractedText}
--- AKHIR DOKUMEN ---

${prompt}`;
      console.log(`[sandbox] Injecting extracted text (${uploadedFile.extractedText.length} chars) for category: ${uploadedFile.category}`);
    }

    // 6. Execute Routing & Failover
    let success = false;
    let aiResponseText = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let lastErrorMsg = "No keys attempted";
    let lastErrorStatus = 500;
    let selectedKeyId: string | null = null;
    let selectedKeyLabel = "";
    let selectedUsageCount = 0;
    let tierUsed = 1;
    let providerUsed = "";
    const startTime = Date.now();

    // Gunakan effectivePrompt sebagai prompt ke provider
    const finalPrompt = effectivePrompt;

    // Group assignments by pool_tier
    const tierGroups: Record<number, string[]> = {};
    for (const asn of assignments) {
      if (!tierGroups[asn.pool_tier]) {
        tierGroups[asn.pool_tier] = [];
      }
      tierGroups[asn.pool_tier].push(asn.provider);
    }

    const sortedTiers = Object.keys(tierGroups).map(Number).sort((a, b) => a - b);

    tierOuterLoop:
    for (const tier of sortedTiers) {
      tierUsed = tier;
      const providersInTier = tierGroups[tier];

      // Fetch active keys
      let dbKeys: any[] = [];
      if (isSupabaseReady) {
        try {
          const { data } = await supabaseAdmin!
            .from("gw_provider_keys")
            .select("id, provider, key_encrypted, usage_count, last_used_at, label, priority, cooldown_until, consecutive_429_count")
            .in("provider", providersInTier)
            .eq("status", "active");
          if (data) dbKeys = data;
        } catch (err) {
          console.warn("[sandbox] Database key retrieval error:", err);
        }
      }

      if (dbKeys.length === 0) {
        // Fallback to env variables
        const candidates: any[] = [];
        for (const p of providersInTier) {
          let envFallbackKey = "";
          if (p === "gemini") envFallbackKey = process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY || "";
          else if (p === "gpt") envFallbackKey = process.env.OPENAI_API_KEY1 || process.env.OPENAI_API_KEY || "";
          else if (p === "claude") envFallbackKey = process.env.CLAUDE_API_KEY1 || process.env.CLAUDE_API_KEY || "";
          else if (p === "grok") envFallbackKey = process.env.GROK_API_KEY1 || process.env.GROK_API_KEY || "";
          else if (p === "deepseek") envFallbackKey = process.env.DEEPSEEK_API_KEY1 || process.env.DEEPSEEK_API_KEY || "";

          if (envFallbackKey && !envFallbackKey.includes("placeholder")) {
            candidates.push({
              id: null,
              key: envFallbackKey,
              label: `${p.toUpperCase()} Env Fallback`,
              provider: p,
              usageCount: 0,
              priority: 0,
              lastUsedAt: null,
              consecutive429Count: 0
            });
          }
        }

        for (const candidate of candidates) {
          selectedKeyId = null;
          selectedKeyLabel = candidate.label;
          selectedUsageCount = 0;
          providerUsed = candidate.provider;
          const providerApiKey = candidate.key;

          const resCall = await attemptCall(candidate.provider, providerApiKey, finalPrompt, systemPrompt, body, selectedKeyId, selectedKeyLabel, parsedFile);
          if (resCall.success) {
            aiResponseText = resCall.aiResponseText;
            promptTokens = resCall.promptTokens;
            completionTokens = resCall.completionTokens;
            success = true;
            break tierOuterLoop;
          } else {
            if (resCall.status === 400) {
              return NextResponse.json({ error: resCall.errorMsg }, { status: 400 });
            }
            lastErrorMsg = resCall.errorMsg;
            lastErrorStatus = resCall.status;
          }
        }
        continue;
      }

      // Decrypt DB keys
      const candidates: any[] = [];
      for (const k of dbKeys) {
        if (k.cooldown_until && new Date(k.cooldown_until) > new Date()) {
          continue;
        }

        try {
          const rawKey = decryptKey(k.key_encrypted);
          if (rawKey) {
            candidates.push({
              id: k.id,
              key: rawKey,
              label: k.label || k.provider,
              provider: k.provider,
              usageCount: k.usage_count,
              priority: k.priority || 0,
              lastUsedAt: k.last_used_at,
              consecutive429Count: k.consecutive_429_count ?? 0
            });
          }
        } catch (err) {
          console.error(`[sandbox] Decrypt error for key ${k.label}:`, err);
        }
      }

      // Sort: priority desc, oldest last_used_at first, lowest usage count
      candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (!a.lastUsedAt && b.lastUsedAt) return -1;
        if (a.lastUsedAt && !b.lastUsedAt) return 1;
        if (a.lastUsedAt && b.lastUsedAt) {
          const diff = new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime();
          if (diff !== 0) return diff;
        }
        return a.usageCount - b.usageCount;
      });

      for (const candidate of candidates) {
        selectedKeyId = candidate.id;
        selectedKeyLabel = candidate.label;
        selectedUsageCount = candidate.usageCount;
        providerUsed = candidate.provider;
        const providerApiKey = candidate.key;

        const resCall = await attemptCall(candidate.provider, providerApiKey, finalPrompt, systemPrompt, body, selectedKeyId, selectedKeyLabel, parsedFile);
        if (resCall.success) {
          aiResponseText = resCall.aiResponseText;
          promptTokens = resCall.promptTokens;
          completionTokens = resCall.completionTokens;
          success = true;

          if (selectedKeyId && supabaseAdmin) {
            await supabaseAdmin
              .from("gw_provider_keys")
              .update({ consecutive_429_count: 0, cooldown_until: null })
              .eq("id", selectedKeyId);
          }
          break tierOuterLoop;
        } else {
          if (resCall.status === 400) {
            return NextResponse.json({ error: resCall.errorMsg }, { status: 400 });
          }

          if (resCall.status === 429 && selectedKeyId && supabaseAdmin) {
            const duration = 60 * Math.pow(2, candidate.consecutive429Count);
            const capped = Math.min(duration, 3600);
            const cooldown = new Date(Date.now() + capped * 1000).toISOString();
            await supabaseAdmin
              .from("gw_provider_keys")
              .update({ cooldown_until: cooldown, consecutive_429_count: candidate.consecutive429Count + 1 })
              .eq("id", selectedKeyId);
          }

          lastErrorMsg = resCall.errorMsg;
          lastErrorStatus = resCall.status;
        }
      }
    }

    if (!success) {
      return NextResponse.json(
        { error: `All tiers and keys for field '${fieldKey}' failed. Last error: ${lastErrorMsg}` },
        { status: lastErrorStatus }
      );
    }

    const latencyMs = Date.now() - startTime;
    const totalTokens = promptTokens + completionTokens;

    // 7. Update usage logs tagged as Internal Sandbox
    if (supabaseAdmin) {
      if (selectedKeyId) {
        await supabaseAdmin
          .from("gw_provider_keys")
          .update({
            usage_count: selectedUsageCount + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", selectedKeyId);
      }

      const isOcrField = fieldKey.startsWith("ocr_") || fieldKey === "visa_registration_extraction";
      const isFallbackToGpt    = isOcrField && providerUsed === "gpt";
      const isFallbackToClaude = isOcrField && providerUsed === "claude";

      // Log usage transaction (api_key_id is NULL to indicate internal usage!)
      await supabaseAdmin!.from("gw_usage_logs").insert({
        api_key_id: null, // Critical flag for Sandbox Usage
        app_name: appName,
        provider: providerUsed,
        task_type: "text",
        tokens_used: totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        latency_ms: latencyMs,
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
        field_key: fieldKey,
        pool_tier_used: tierUsed,
        ocr_fallback_to_gpt:    isFallbackToGpt,
        ocr_fallback_to_claude: isFallbackToClaude
      });
    }

    // 8. Return wrapped response in standard envelope
    let result: any = aiResponseText;
    let dataCenterId: string | null = null;
    
    if (fieldSpec?.output_schema) {
      try {
        const cleanedText = aiResponseText.replace(/```json/g, "").replace(/```/g, "").trim();
        result = JSON.parse(cleanedText);

        const { saveToDataCenter } = require("@/lib/data-center");
        dataCenterId = await saveToDataCenter({
          client_app_id: null,
          field_key: fieldKey,
          source_type: "ocr_upload",
          extracted_data: result,
          raw_text: uploadedFile?.extractedText || aiResponseText,
          fileBase64: uploadedFile ? `data:${uploadedFile.originalMimeType};base64,${uploadedFile.originalBase64}` : fileBase64,
          fileMimeType: uploadedFile?.originalMimeType || null
        });
      } catch (e) {
        console.warn("[sandbox] Failed to parse structured output JSON or save to Data Center:", e);
      }
    }

    return NextResponse.json({
      field: fieldKey,
      schema_version: "1.0",
      provider_used: providerUsed,
      processed_at: new Date().toISOString(),
      result: result,
      ...(dataCenterId ? { data_center_id: dataCenterId } : {})
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Sandbox internal server error" }, { status: 500 });
  }
}
