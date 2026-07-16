import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptKey, hashApiKey } from "@/lib/crypto";
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

    // Support file uploads (base64 string images)
    const fileBase64 = body.file || body.image;
    let parsedFile: { mimeType: string; base64Data: string } | null = null;
    if (fileBase64) {
      if (fileBase64.startsWith("data:")) {
        const matches = fileBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
        if (matches && matches.length >= 3) {
          parsedFile = {
            mimeType: matches[1],
            base64Data: matches[2]
          };
        }
      } else {
        parsedFile = {
          mimeType: "image/jpeg",
          base64Data: fileBase64
        };
      }
    }

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

    // Append core knowledge base context
    resolvedSystemPrompt += `\n\nBerikut adalah profil korporat dan basis pengetahuan produk kami. Gunakan informasi ini jika relevan untuk menjawab pertanyaan:

Business Profile Context:
${profileContent}

Product Knowledge Base Context:
${knowledgeContext || "No product documents configured."}`;

    const systemPrompt = resolvedSystemPrompt;

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
        .select("id, provider, key_encrypted, usage_count, last_used_at, label, priority, cooldown_until, consecutive_429_count")
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
              consecutive429Count: k.consecutive_429_count ?? 0
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

        const resCall = await attemptCall(candidate.provider, providerApiKey, prompt, systemPrompt, body, selectedKeyId, selectedKeyLabel, parsedFile);
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

      const isOcrField = fieldKey.startsWith("ocr_");
      const isFallbackToGpt = isOcrField && providerUsed === "gpt";

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
        ocr_fallback_to_gpt: isFallbackToGpt
      });
    }

    // 8. Return wrapped response in standard envelope
    let result: any = aiResponseText;
    if (fieldSpec?.output_schema) {
      try {
        const cleanedText = aiResponseText.replace(/```json/g, "").replace(/```/g, "").trim();
        result = JSON.parse(cleanedText);
      } catch (e) {
        console.warn("[gateway] Failed to parse structured output JSON:", e);
      }
    }

    return NextResponse.json({
      field: fieldKey,
      schema_version: "1.0",
      provider_used: providerUsed,
      processed_at: new Date().toISOString(),
      result: result
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gateway internal server error" }, { status: 500 });
  }
}

// ── attemptCall Helper Function ──────────────────────────────────────────
export async function attemptCall(
  provider: string,
  providerApiKey: string,
  prompt: string,
  systemPrompt: string,
  body: any,
  selectedKeyId: string | null,
  selectedKeyLabel: string,
  parsedFile?: { mimeType: string; base64Data: string } | null
) {
  try {
    if (provider === "gemini") {
      const parts: any[] = [{ text: prompt }];
      if (parsedFile) {
        parts.push({
          inlineData: {
            mimeType: parsedFile.mimeType,
            data: parsedFile.base64Data
          }
        });
      }

      let modelToUse = "gemini-3.1-flash-lite";
      let res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${providerApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: body.temperature ?? 0.7,
              maxOutputTokens: body.max_tokens ?? 2000,
            }
          }),
        }
      );

      if (!res.ok) {
        const firstErr = await res.json().catch(() => ({}));
        console.warn(`[gateway] Gemini attempt with ${modelToUse} failed: ${firstErr.error?.message || "Unknown error"}. Retrying with gemini-3.5-flash...`);
        modelToUse = "gemini-3.5-flash";
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${providerApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: {
                temperature: body.temperature ?? 0.7,
                maxOutputTokens: body.max_tokens ?? 2000,
              }
            }),
          }
        );
      }

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = resJson.error?.message || "Gemini API error";
        console.warn(`[gateway] Gemini key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);
        
        if (res.status === 400) {
          return { success: false, errorMsg, status: 400 };
        }

        if (selectedKeyId && supabaseAdmin && (res.status === 401 || res.status === 403)) {
          console.warn(`[gateway] Auto-disabling key in DB: ${selectedKeyLabel}`);
          await supabaseAdmin
            .from("gw_provider_keys")
            .update({ status: "disabled" })
            .eq("id", selectedKeyId);
        }

        return { success: false, errorMsg, status: res.status };
      }

      const aiResponseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const promptTokens = Math.ceil(prompt.length / 4) + Math.ceil(systemPrompt.length / 4);
      const completionTokens = Math.ceil(aiResponseText.length / 4);
      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    }

    if (provider === "gpt") {
      let contentArray: any[] = [{ type: "text", text: prompt }];
      if (parsedFile) {
        contentArray.push({
          type: "image_url",
          image_url: {
            url: `data:${parsedFile.mimeType};base64,${parsedFile.base64Data}`
          }
        });
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${providerApiKey}`
        },
        body: JSON.stringify({
          model: body.model_name || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: contentArray }
          ],
          temperature: body.temperature ?? 0.7,
          max_tokens: body.max_tokens ?? 2000,
        }),
      });

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = resJson.error?.message || "OpenAI API error";
        console.warn(`[gateway] GPT key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);

        if (res.status === 400) {
          return { success: false, errorMsg, status: 400 };
        }

        if (selectedKeyId && supabaseAdmin && (res.status === 401 || res.status === 403)) {
          console.warn(`[gateway] Auto-disabling key in DB: ${selectedKeyLabel}`);
          await supabaseAdmin
            .from("gw_provider_keys")
            .update({ status: "disabled" })
            .eq("id", selectedKeyId);
        }

        return { success: false, errorMsg, status: res.status };
      }

      const aiResponseText = resJson.choices?.[0]?.message?.content || "";
      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;
      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    }

    if (provider === "claude") {
      let contentArray: any[] = [{ type: "text", text: prompt }];
      if (parsedFile) {
        contentArray.push({
          type: "image",
          source: {
            type: "base64",
            media_type: parsedFile.mimeType,
            data: parsedFile.base64Data
          }
        });
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": providerApiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: body.model_name || "claude-3-5-sonnet-20241022",
          max_tokens: body.max_tokens ?? 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: contentArray }],
          temperature: body.temperature ?? 0.7,
        }),
      });

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = resJson.error?.message || "Anthropic API error";
        console.warn(`[gateway] Claude key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);

        if (res.status === 400) {
          return { success: false, errorMsg, status: 400 };
        }

        if (selectedKeyId && supabaseAdmin && (res.status === 401 || res.status === 403)) {
          console.warn(`[gateway] Auto-disabling key in DB: ${selectedKeyLabel}`);
          await supabaseAdmin
            .from("gw_provider_keys")
            .update({ status: "disabled" })
            .eq("id", selectedKeyId);
        }

        return { success: false, errorMsg, status: res.status };
      }

      const aiResponseText = resJson.content?.[0]?.text || "";
      const promptTokens = resJson.usage?.input_tokens || 0;
      const completionTokens = resJson.usage?.output_tokens || 0;
      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    }

    if (provider === "grok") {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${providerApiKey}`
        },
        body: JSON.stringify({
          model: body.model_name || "grok-2",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: body.temperature ?? 0.7,
        }),
      });

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = resJson.error?.message || "Grok API error";
        console.warn(`[gateway] Grok key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);

        if (res.status === 400) {
          return { success: false, errorMsg, status: 400 };
        }

        if (selectedKeyId && supabaseAdmin && (res.status === 401 || res.status === 403)) {
          console.warn(`[gateway] Auto-disabling key in DB: ${selectedKeyLabel}`);
          await supabaseAdmin
            .from("gw_provider_keys")
            .update({ status: "disabled" })
            .eq("id", selectedKeyId);
        }

        return { success: false, errorMsg, status: res.status };
      }

      const aiResponseText = resJson.choices?.[0]?.message?.content || "";
      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;
      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    }

    if (provider === "deepseek") {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${providerApiKey}`
        },
        body: JSON.stringify({
          model: body.model_name || "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: body.temperature ?? 0.7,
          max_tokens: body.max_tokens ?? 2000,
        }),
      });

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = resJson.error?.message || "Deepseek API error";
        console.warn(`[gateway] Deepseek key failed: ${selectedKeyLabel}. Status: ${res.status}. Error: ${errorMsg}`);

        if (res.status === 400) {
          return { success: false, errorMsg, status: 400 };
        }

        if (selectedKeyId && supabaseAdmin && (res.status === 401 || res.status === 403)) {
          console.warn(`[gateway] Auto-disabling key in DB: ${selectedKeyLabel}`);
          await supabaseAdmin
            .from("gw_provider_keys")
            .update({ status: "disabled" })
            .eq("id", selectedKeyId);
        }

        return { success: false, errorMsg, status: res.status };
      }

      const aiResponseText = resJson.choices?.[0]?.message?.content || "";
      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;
      return { success: true, aiResponseText, promptTokens, completionTokens, errorMsg: "", status: 200 };
    }

    return { success: false, errorMsg: `Unsupported provider: ${provider}`, status: 400 };
  } catch (err: any) {
    console.error(`[gateway] Exception while calling ${selectedKeyLabel}:`, err);
    return { success: false, errorMsg: err.message || "Network error or timeout", status: 500 };
  }
}
