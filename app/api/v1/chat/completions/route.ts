import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptKey, hashApiKey } from "@/lib/crypto";
import { parseUploadedFile, type ParsedFileResult } from "@/lib/file-parser";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    // 1. Authenticate API Key
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Bearer token in Authorization header is required" }, { status: 401 });
    }

    const gatewayKey = authHeader.substring(7).trim();
    if (!gatewayKey) {
      return NextResponse.json({ error: "API key token is empty" }, { status: 401 });
    }

    const keyHash = hashApiKey(gatewayKey);

    // Fetch key and associated app metadata
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from("gw_api_keys")
      .select("id, client_app_id, provider_scope, rate_limit_per_day, status, gw_client_apps(name, slug)")
      .eq("key_hash", keyHash)
      .eq("status", "active")
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
    }

    const appInfo = keyData.gw_client_apps as any;
    const appName = appInfo?.name || "Client App";
    const appSlug = appInfo?.slug || "";

    // 2. Rate Limit Checks (Daily limit per Key)
    if (keyData.rate_limit_per_day) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count, error: countError } = await supabaseAdmin
        .from("gw_usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("api_key_id", keyData.id)
        .gte("created_at", startOfDay.toISOString());

      if (!countError && count !== null && count >= keyData.rate_limit_per_day) {
        return NextResponse.json(
          { error: `Rate limit harian tercapai. Maksimum ${keyData.rate_limit_per_day} panggilan per hari.` },
          { status: 429 }
        );
      }
    }

    // 3. Parse input payload
    const body = await req.json().catch(() => ({}));
    let prompt = "";
    
    // Support both standard OpenAI "messages" array and simple "prompt" string
    if (body.prompt) {
      prompt = body.prompt;
    } else if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
      prompt = body.messages[body.messages.length - 1].content || "";
    }

    if (!prompt) {
      return NextResponse.json({ error: "Prompt or messages are required" }, { status: 400 });
    }

    // ── Deteksi dan parsing semua tipe file yang diunggah ─────────────────
    const fileBase64 = body.file || body.image;
    let uploadedFile: ParsedFileResult | null = null;

    if (fileBase64) {
      uploadedFile = await parseUploadedFile(fileBase64);

      if (uploadedFile.category === "unsupported") {
        return NextResponse.json({ error: uploadedFile.error }, { status: 400 });
      }

      // Untuk pdf-scanned, hanya Gemini yang didukung
      // (GPT/Claude tidak bisa menerima PDF langsung)
      if (uploadedFile.category === "pdf-scanned") {
        // Tandai di body agar bisa digunakan di routing
        (body as any).__pdfScanned = true;
      }
    }

    // Kompatibilitas backward: parsedFile untuk vision pipeline (image / pdf-scanned)
    const parsedFile = uploadedFile?.imageData ? {
      mimeType: uploadedFile.imageData.mimeType,
      base64Data: uploadedFile.imageData.base64Data
    } : null;

    // ── 3a. Validate Job Routing Field ────────────────────────────────────
    let validKeys = [
      "ocr_id_document",
      "ocr_travel_document",
      "ocr_financial_document",
      "ocr_general_document",
      "ocr_photo_validation",
      "content_generation",
      "coding_assistant",
      "chatbot_general",
      "chatbot_checkout",
      "orchestrator",
      "chatbot",
      "reasoning_general",
      "face_liveness_scan"
    ];

    try {
      const { data: dbFields } = await supabaseAdmin
        .from("gw_ai_fields")
        .select("field_key, display_name");

      if (dbFields && dbFields.length > 0) {
        validKeys = dbFields.map((f) => f.field_key);
      } else {
        const dbPath = path.resolve(process.cwd(), "db.json");
        if (fs.existsSync(dbPath)) {
          const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
          if (db.aiFields && db.aiFields.length > 0) {
            validKeys = db.aiFields.map((f: any) => f.field_key);
          }
        }
      }
    } catch (e) {
      const dbPath = path.resolve(process.cwd(), "db.json");
      if (fs.existsSync(dbPath)) {
        const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        if (db.aiFields && db.aiFields.length > 0) {
          validKeys = db.aiFields.map((f: any) => f.field_key);
        }
      }
    }

    if (!body.field || !validKeys.includes(body.field)) {
      return NextResponse.json(
        { error: `Parameter 'field' is required and must be one of: ${validKeys.join(", ")}` },
        { status: 400 }
      );
    }
    const fieldKey = body.field;

    // ── 3b. Fetch Pool Assignments for the Field ──────────────────────────
    let assignments: any[] = [];
    let isDbAssigned = false;

    try {
      const { data, error: assignError } = await supabaseAdmin
        .from("gw_field_pool_assignments")
        .select("provider, pool_tier")
        .eq("field_key", fieldKey)
        .order("pool_tier", { ascending: true });

      if (!assignError && data && data.length > 0) {
        assignments = data;
        isDbAssigned = true;
      }
    } catch (e) {
      // Ignore DB error, fall back to db.json
    }

    if (!isDbAssigned) {
      const dbPath = path.resolve(process.cwd(), "db.json");
      if (fs.existsSync(dbPath)) {
        const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        if (db.fieldPoolAssignments) {
          assignments = db.fieldPoolAssignments
            .filter((a: any) => a.field_key === fieldKey)
            .map((a: any) => ({
              provider: a.provider,
              pool_tier: a.pool_tier
            }))
            .sort((a: any, b: any) => a.pool_tier - b.pool_tier);
        }
      }
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json(
        { error: `No active pool assignments configured for field: ${fieldKey}` },
        { status: 400 }
      );
    }

    // 4. Retrieve RAG Knowledge Context
    let knowledgeContext = "";
    let profileContent = "";

    const [{ data: docs }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("gw_knowledge_documents")
        .select("title, content, client_app_id"),
      supabaseAdmin
        .from("gw_business_profile")
        .select("content")
        .limit(1)
        .single()
    ]);

    profileContent = profile?.content || "";
    
    // Filter docs scoped to either this client_app_id or global (null)
    const filteredDocs = (docs || []).filter(
      (d) => !d.client_app_id || d.client_app_id === keyData.client_app_id
    );

    knowledgeContext = filteredDocs
      .map((d) => `Document: "${d.title}"\nContent: ${d.content}`)
      .join("\n\n");

    // 4b. Fetch Field Spec for System Prompt & Output Schema
    let fieldSpec: any = null;
    try {
      const { data: specData } = await supabaseAdmin
        .from("gw_field_specs")
        .select("system_prompt, output_schema")
        .eq("field_key", fieldKey)
        .maybeSingle();

      if (specData) {
        fieldSpec = specData;
      }
    } catch (err) {
      console.warn("[gateway] Database error fetching field spec, falling back to local json:", err);
    }

    if (!fieldSpec) {
      try {
        const dbPath = path.resolve(process.cwd(), "db.json");
        if (fs.existsSync(dbPath)) {
          const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
          fieldSpec = (db.fieldSpecs || []).find((s: any) => s.field_key === fieldKey);
        }
      } catch (err) {
        console.error("[gateway] Failed to load local fieldSpecs fallback:", err);
      }
    }

    let resolvedSystemPrompt = "";
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

    // 4c. Injeksi Persona untuk chat fields (chatbot_general, chatbot_checkout)
    const CHAT_FIELDS = ["chatbot_general", "chatbot_checkout"];
    if (CHAT_FIELDS.includes(fieldKey) && supabaseAdmin) {
      try {
        const { data: persona } = await supabaseAdmin
          .from("gw_chat_personas")
          .select("persona_name, tone_description, language_default, must_never_say")
          .eq("client_app_id", keyData.client_app_id)
          .maybeSingle();

        if (persona) {
          const neverSayLines = (persona.must_never_say || [])
            .map((rule: string) => `- ${rule}`)
            .join("\n");

          const personaBlock = `--- PERSONA ---
Nama: ${persona.persona_name}
Tone & Gaya: ${persona.tone_description}
Bahasa Default: ${persona.language_default === "id" ? "Bahasa Indonesia" : "English"}
Aturan Wajib (JANGAN PERNAH dilanggar):
${neverSayLines || "- (tidak ada)"}
--- INSTRUKSI TUGAS ---
${resolvedSystemPrompt}`;

          resolvedSystemPrompt = personaBlock;
          console.log(`[gateway] Persona injected for field '${fieldKey}': ${persona.persona_name}`);
        } else {
          // Tidak ada persona terkonfigurasi — fallback ke persona generik, log warning
          console.warn(
            `[gateway] WARNING: Tidak ada persona untuk client_app_id=${keyData.client_app_id} pada field=${fieldKey}. ` +
            `Menggunakan persona generik. Konfigurasikan persona di dashboard.`
          );
          resolvedSystemPrompt = `--- PERSONA ---
Nama: AI Assistant (Generic)
Tone & Gaya: Netral, profesional, membantu
--- INSTRUKSI TUGAS ---
${resolvedSystemPrompt}`;
        }
      } catch (personaErr) {
        console.warn("[gateway] Gagal fetch persona, lanjut tanpa persona:", personaErr);
      }
    }

    // Append core knowledge base context
    resolvedSystemPrompt += `\n\nBerikut adalah profil korporat dan basis pengetahuan produk kami. Gunakan informasi ini jika relevan untuk menjawab pertanyaan:

Business Profile Context:
${profileContent}

Product Knowledge Base Context:
${knowledgeContext || "No product documents configured."}`;

    // ── Injeksi konten dokumen untuk tipe teks (PDF-text, DOCX, CSV, TXT) ──
    let effectivePrompt = prompt;
    if (uploadedFile?.extractedText) {
      effectivePrompt = `--- ISI DOKUMEN (${uploadedFile.originalMimeType}) ---
${uploadedFile.extractedText}
--- AKHIR DOKUMEN ---

${prompt}`;
      console.log(`[gateway] Injecting extracted text (${uploadedFile.extractedText.length} chars) into prompt for category: ${uploadedFile.category}`);
    }

    const systemPrompt = resolvedSystemPrompt;
    // Gunakan effectivePrompt sebagai prompt yang dikirim ke provider
    prompt = effectivePrompt;

    // 5. Execute Routing & Failover across Tiers and Providers
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

    // Group assignments by pool_tier
    const tierGroups: Record<number, string[]> = {};
    for (const asn of assignments) {
      if (!tierGroups[asn.pool_tier]) {
        tierGroups[asn.pool_tier] = [];
      }
      tierGroups[asn.pool_tier].push(asn.provider);
    }

    // Get sorted list of tiers (e.g., [1, 2, 3])
    const sortedTiers = Object.keys(tierGroups).map(Number).sort((a, b) => a - b);

    // Loop through each tier
    tierOuterLoop:
    for (const tier of sortedTiers) {
      tierUsed = tier;
      const providersInTier = tierGroups[tier].filter(
        (p) => !keyData.provider_scope || keyData.provider_scope.includes(p)
      );

      if (providersInTier.length === 0) {
        console.warn(`[gateway] No allowed providers in tier ${tier} for current key scope: ${keyData.provider_scope}`);
        continue;
      }

      // Fetch active keys for providers in this tier
      const { data: dbKeys, error: dbKeysError } = await supabaseAdmin
        .from("gw_provider_keys")
        .select("id, provider, key_encrypted, usage_count, last_used_at, label, priority, cooldown_until, consecutive_429_count, base_url, model_name")
        .in("provider", providersInTier)
        .eq("status", "active");

      if (dbKeysError || !dbKeys || dbKeys.length === 0) {
        console.warn(`[gateway] No active keys found in DB for tier ${tier} providers: ${providersInTier.join(", ")}`);
        // Fallback to env variables if available for these providers
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

        if (candidates.length === 0) {
          continue; // Go to next tier
        }

        for (const candidate of candidates) {
          selectedKeyId = null;
          selectedKeyLabel = candidate.label;
          selectedUsageCount = 0;
          providerUsed = candidate.provider;
          const providerApiKey = candidate.key;

          const resCall = await attemptCall(candidate.provider, providerApiKey, prompt, systemPrompt, body, selectedKeyId, selectedKeyLabel, parsedFile);
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

      // Decrypt and build candidates array from DB keys
      interface CandidateKey {
        id: string;
        key: string;
        label: string;
        provider: string;
        usageCount: number;
        priority: number;
        lastUsedAt: string | null;
        consecutive429Count: number;
        base_url?: string | null;
        model_name?: string | null;
      }

      const candidates: CandidateKey[] = [];
      for (const k of dbKeys) {
        // Skip keys in cooldown
        if (k.cooldown_until && new Date(k.cooldown_until) > new Date()) {
          console.log(`[gateway] Skipping key ${k.label} (in cooldown until ${k.cooldown_until})`);
          continue;
        }

        try {
          const raw = decryptKey(k.key_encrypted);
          if (raw && !raw.includes("placeholder")) {
            candidates.push({
              id: k.id,
              key: raw,
              label: k.label || `${k.provider} key`,
              provider: k.provider,
              usageCount: k.usage_count ?? 0,
              priority: k.priority ?? 0,
              lastUsedAt: k.last_used_at,
              consecutive429Count: k.consecutive_429_count ?? 0,
              base_url: k.base_url,
              model_name: k.model_name
            });
          }
        } catch (err) {
          console.error(`[gateway] Decrypt error for key ${k.label}:`, err);
        }
      }

      // Sort candidates within this tier:
      // 1. priority descending
      // 2. oldest last_used_at (nulls first)
      // 3. lowest usage_count
      candidates.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        
        if (!a.lastUsedAt && b.lastUsedAt) return -1;
        if (a.lastUsedAt && !b.lastUsedAt) return 1;
        if (a.lastUsedAt && b.lastUsedAt) {
          const diff = new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime();
          if (diff !== 0) return diff;
        }

        return a.usageCount - b.usageCount;
      });

      // Try candidates in this tier
      for (const candidate of candidates) {
        selectedKeyId = candidate.id;
        selectedKeyLabel = candidate.label;
        selectedUsageCount = candidate.usageCount;
        providerUsed = candidate.provider;
        const providerApiKey = candidate.key;

        const resCall = await attemptCall(
          candidate.provider,
          providerApiKey,
          prompt,
          systemPrompt,
          body,
          selectedKeyId,
          selectedKeyLabel,
          parsedFile,
          candidate.base_url,
          candidate.model_name
        );
        if (resCall.success) {
          aiResponseText = resCall.aiResponseText;
          promptTokens = resCall.promptTokens;
          completionTokens = resCall.completionTokens;
          success = true;

          // Reset cooldown stats on success
          if (selectedKeyId && supabaseAdmin) {
            await supabaseAdmin
              .from("gw_provider_keys")
              .update({
                consecutive_429_count: 0,
                cooldown_until: null
              })
              .eq("id", selectedKeyId);
          }

          break tierOuterLoop;
        } else {
          if (resCall.status === 400) {
            return NextResponse.json({ error: resCall.errorMsg }, { status: 400 });
          }

          // Handle 429 Cooldown (Exponential backoff)
          if (resCall.status === 429 && selectedKeyId && supabaseAdmin) {
            const consecutive = candidate.consecutive429Count;
            const duration = 60 * Math.pow(2, consecutive); // 60s, 120s, 240s...
            const cappedDuration = Math.min(duration, 3600); // Max 1 hour (3600s)
            const cooldownTime = new Date(Date.now() + cappedDuration * 1000).toISOString();

            console.warn(`[gateway] 429 rate limit hit on key ${selectedKeyLabel}. Cooldown set for ${cappedDuration}s until ${cooldownTime}`);
            await supabaseAdmin
              .from("gw_provider_keys")
              .update({
                cooldown_until: cooldownTime,
                consecutive_429_count: consecutive + 1
              })
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

    // 7. Update LRU & Stats async
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

      await supabaseAdmin
        .from("gw_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyData.id);

      const isOcrField = fieldKey.startsWith("ocr_") || fieldKey === "visa_registration_extraction";
      const isFallbackToGpt    = isOcrField && providerUsed === "gpt";
      const isFallbackToClaude = isOcrField && providerUsed === "claude";

      // Log usage transaction
      await supabaseAdmin.from("gw_usage_logs").insert({
        api_key_id: keyData.id,
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
          client_app_id: keyData.client_app_id,
          field_key: fieldKey,
          source_type: "ocr_upload",
          extracted_data: result,
          // Untuk dokumen teks: simpan teks yang diekstrak, bukan response JSON mentah
          raw_text: uploadedFile?.extractedText || aiResponseText,
          // Simpan file ORIGINAL (bukan konversi WebP)
          fileBase64: uploadedFile ? `data:${uploadedFile.originalMimeType};base64,${uploadedFile.originalBase64}` : fileBase64,
          fileMimeType: uploadedFile?.originalMimeType || null
        });
      } catch (e) {
        console.warn("[gateway] Failed to parse structured output JSON or save to Data Center:", e);
      }
    }

    // 9. Log non-OCR AI interactions to Data Center (chatbot, content, etc.)
    if (supabaseAdmin && !fieldSpec?.output_schema) {
      const isChatbot = fieldKey.startsWith("chatbot_") || fieldKey === "chatbot";
      const isContent = fieldKey.startsWith("content_");
      if (isChatbot || isContent) {
        try {
          const { saveToDataCenter } = require("@/lib/data-center");
          await saveToDataCenter({
            client_app_id: keyData.client_app_id,
            field_key: fieldKey,
            source_type: isChatbot ? "chatbot_interaction" : "content_generation",
            extracted_data: {},
            raw_text: [
              `[PROMPT] ${prompt.substring(0, 500)}`,
              `[RESPONSE] ${aiResponseText.substring(0, 1000)}`
            ].join("\n---\n"),
          });
        } catch (e) {
          console.warn("[gateway] Failed to log AI interaction to Data Center:", e);
        }
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
    return NextResponse.json({ error: err.message || "Gateway internal server error" }, { status: 500 });
  }
}

// ── attemptCall Helper Function ──────────────────────────────────────────
// Uses the central ProviderAdapter registry instead of hardcoded if/else chains.
// To support a new provider, add its adapter to lib/provider-adapters/index.ts only.
import { PROVIDER_REGISTRY } from "@/lib/provider-adapters";

export async function attemptCall(
  provider: string,
  providerApiKey: string,
  prompt: string,
  systemPrompt: string,
  body: any,
  selectedKeyId: string | null,
  selectedKeyLabel: string,
  parsedFile?: { mimeType: string; base64Data: string } | null,
  baseUrl?: string | null,
  modelNameOverride?: string | null
) {
  const adapter = PROVIDER_REGISTRY[provider];
  if (!adapter) {
    return { success: false, errorMsg: `Unsupported provider: ${provider}`, status: 400, aiResponseText: "", promptTokens: 0, completionTokens: 0 };
  }

  return adapter.call(
    providerApiKey,
    prompt,
    systemPrompt,
    {
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      model_name: modelNameOverride || body.model_name,
      base_url: baseUrl,
    },
    parsedFile ?? null,
    selectedKeyId,
    selectedKeyLabel
  );
}

