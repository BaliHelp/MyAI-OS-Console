import { supabaseAdmin } from "./supabase";
import { encryptKey, decryptKey } from "./crypto";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require("crypto") as typeof import("crypto");


/**
 * Automatically import provider API keys from environment variables.
 */
export async function importEnvProviderKeys(): Promise<void> {
  const envKeys = [
    // Gemini Keys
    { envVar: "GEMINI_API_KEY1", provider: "gemini", label: "Gemini Key 1", priority: 0 },
    { envVar: "GEMINI_API_KEY2", provider: "gemini", label: "Gemini Key 2", priority: 0 },
    { envVar: "GEMINI_API_KEY3", provider: "gemini", label: "Gemini Key 3", priority: 0 },
    { envVar: "GEMINI_API_KEY4", provider: "gemini", label: "Gemini Key 4", priority: 0 },
    { envVar: "GEMINI_API_KEY5", provider: "gemini", label: "Gemini Key 5", priority: 0 },
    { envVar: "GEMINI_API_KEY6", provider: "gemini", label: "Gemini Key 6", priority: 0 },
    // GPT Keys
    { envVar: "OPENAI_API_KEY1", provider: "gpt", label: "GPT Key 1 (Agent - Prioritas)", priority: 10 },
    { envVar: "OPENAI_API_KEY2", provider: "gpt", label: "GPT Key 2", priority: 0 },
    { envVar: "OPENAI_API_KEY3", provider: "gpt", label: "GPT Key 3", priority: 0 },
    { envVar: "OPENAI_API_KEY4", provider: "gpt", label: "GPT Key 4", priority: 0 },
    { envVar: "OPENAI_API_KEY5", provider: "gpt", label: "GPT Key 5 (Prioritas)", priority: 5 },
    // Claude Keys
    { envVar: "CLAUDE_API_KEY1", provider: "claude", label: "Claude Key 1", priority: 0 },
    // Grok Keys
    { envVar: "GROK_API_KEY1", provider: "grok", label: "Grok Key 1", priority: 0 },
    // Deepseek Keys
    { envVar: "DEEPSEEK_API_KEY1", provider: "deepseek", label: "Deepseek Key 1", priority: 0 },
  ];

  if (!supabaseAdmin) return;

  // 1. Fetch all existing keys from the DB
  const { data: dbKeys, error: fetchError } = await supabaseAdmin
    .from("gw_provider_keys")
    .select("id, key_encrypted, label, provider, status, priority");

  if (fetchError) {
    console.log(`[migrate] Skip importing keys (table gw_provider_keys may not exist yet: ${fetchError.message})`);
    return;
  }

  // 2. Parse current env values
  const envKeyValues = envKeys.map(item => {
    const rawVal = process.env[item.envVar]?.trim() || "";
    return {
      ...item,
      value: rawVal,
    };
  }).filter(item => item.value.length > 0 && !item.value.includes("placeholder"));

  // 3. Reconcile DB keys with env values
  const envValuesProcessed = new Set<string>();

  for (const dbKey of dbKeys || []) {
    let decrypted = "";
    try {
      decrypted = decryptKey(dbKey.key_encrypted).trim();
    } catch (e) {}

    if (!decrypted) continue;

    // Check if this decrypted value matches any of our current env values
    const matchedEnv = envKeyValues.find(item => item.value === decrypted);
    if (matchedEnv) {
      if (envValuesProcessed.has(decrypted)) {
        // This is a duplicate key in the DB! Delete it.
        console.log(`[migrate] Deleting duplicate key in DB: ${dbKey.label} (${dbKey.id})`);
        await supabaseAdmin.from("gw_provider_keys").delete().eq("id", dbKey.id);
      } else {
        // Matched! Update its label, provider, and priority to match the env.
        if (dbKey.label !== matchedEnv.label || dbKey.provider !== matchedEnv.provider || dbKey.priority !== matchedEnv.priority) {
          console.log(`[migrate] Updating label/provider/priority for key in DB: ${dbKey.label} -> ${matchedEnv.label}`);
          await supabaseAdmin
            .from("gw_provider_keys")
            .update({ 
              label: matchedEnv.label, 
              provider: matchedEnv.provider,
              priority: matchedEnv.priority
            })
            .eq("id", dbKey.id);
        }
        envValuesProcessed.add(decrypted);
      }
    } else {
      // It is not in the current env.
      // Is it a legacy auto-imported key? (A key whose label starts with one of our prefix labels)
      const isLegacyAutoImported = 
        dbKey.label?.startsWith("Gemini Key ") || 
        dbKey.label?.startsWith("GPT Key ") || 
        dbKey.label?.startsWith("Claude Key ") || 
        dbKey.label?.startsWith("Grok Key ") ||
        dbKey.label?.startsWith("Deepseek Key ");
      
      if (isLegacyAutoImported) {
        // Keep it in DB so database acts as the single source of truth,
        // even if Vercel server starts without these environment variables.
        console.log(`[migrate] Keep legacy auto-imported key in DB: ${dbKey.label}`);
      }
    }
  }

  // 4. For any current env values that were not matched in the DB, insert them!
  for (const envKey of envKeyValues) {
    if (!envValuesProcessed.has(envKey.value)) {
      console.log(`[migrate] Inserting new key from env: ${envKey.label}`);
      const encrypted = encryptKey(envKey.value);
      await supabaseAdmin.from("gw_provider_keys").insert({
        provider: envKey.provider,
        label: envKey.label,
        key_encrypted: encrypted,
        status: "active",
        priority: envKey.priority
      });
      envValuesProcessed.add(envKey.value);
    }
  }

  console.log(`[migrate] API key sync complete.`);
}

/**
 * One-time migration: seeds data from db.json into Supabase.
 * Only runs if tables are empty — idempotent.
 * Called from instrumentation.ts on server startup.
 */
export async function runSeedMigration(): Promise<void> {
  if (!supabaseAdmin) {
    console.log("[migrate] Supabase not configured — skipping seed migration.");
    return;
  }

  // 1. Unconditionally import Gemini API keys from env if they aren't in the DB yet
  try {
    await importEnvProviderKeys();
  } catch (err) {
    console.error("[migrate] ❌ Failed to import env provider keys:", err);
  }

  try {
    // Check if client_apps table already has data
    const { count } = await supabaseAdmin
      .from("gw_client_apps")
      .select("*", { count: "exact", head: true });

    if (count && count > 0) {
      console.log(`[migrate] ⏭ DB already has ${count} apps. Skipping seed.`);
      return;
    }


    console.log("[migrate] 🌱 Seeding database from initial data...");

    // ── Seed client_apps ───────────────────────────────────────────────────
    const appsToInsert = [
      { name: "Indonesian Visas", slug: "indonesian-visas", tier: "internal", status: "active", created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
      { name: "Tropic Tech", slug: "tropic-tech", tier: "internal", status: "active", created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString() },
      { name: "MyBusiness Website", slug: "mybusiness-website", tier: "internal", status: "active", created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
      { name: "MyBusiness Playstore", slug: "mybusiness-playstore", tier: "internal", status: "active", created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
      { name: "MyBusiness Appstore", slug: "mybusiness-appstore", tier: "community", status: "active", created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
    ];

    const { data: insertedApps, error: appsError } = await supabaseAdmin
      .from("gw_client_apps")
      .insert(appsToInsert)
      .select();

    if (appsError) throw new Error(`apps seed error: ${appsError.message}`);
    console.log(`[migrate] ✅ Seeded ${insertedApps?.length} client_apps`);

    // Build a slug → id map
    const appIdBySlug: Record<string, string> = {};
    insertedApps?.forEach((a: { slug: string; id: string }) => {
      appIdBySlug[a.slug] = a.id;
    });

    // ── Seed api_keys ──────────────────────────────────────────────────────
    const keysToInsert = [
      {
        client_app_id: appIdBySlug["indonesian-visas"],
        key_prefix: "sk_visas_a8f3",
        key_hash: crypto.createHash("sha256").update("sk_visas_a8f3_seedkey1").digest("hex"),
        provider_scope: ["claude", "gpt", "gemini"],
        rate_limit_per_day: null,
        status: "active",
        created_at: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
        last_used_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        client_app_id: appIdBySlug["tropic-tech"],
        key_prefix: "sk_tropic_7d2f",
        key_hash: crypto.createHash("sha256").update("sk_tropic_7d2f_seedkey2").digest("hex"),
        provider_scope: ["claude", "gemini"],
        rate_limit_per_day: null,
        status: "active",
        created_at: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000).toISOString(),
        last_used_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
      },
      {
        client_app_id: appIdBySlug["mybusiness-website"],
        key_prefix: "sk_myweb_bc11",
        key_hash: crypto.createHash("sha256").update("sk_myweb_bc11_seedkey3").digest("hex"),
        provider_scope: ["gpt", "gemini"],
        rate_limit_per_day: null,
        status: "active",
        created_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
        last_used_at: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      },
      {
        client_app_id: appIdBySlug["mybusiness-playstore"],
        key_prefix: "sk_myplay_910e",
        key_hash: crypto.createHash("sha256").update("sk_myplay_910e_seedkey4").digest("hex"),
        provider_scope: ["gemini"],
        rate_limit_per_day: null,
        status: "active",
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        last_used_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      {
        client_app_id: appIdBySlug["mybusiness-appstore"],
        key_prefix: "sk_mystore_3e4d",
        key_hash: crypto.createHash("sha256").update("sk_mystore_3e4d_seedkey5").digest("hex"),
        provider_scope: ["claude", "gpt"],
        rate_limit_per_day: 1000,
        status: "active",
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        last_used_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const { data: insertedKeys, error: keysError } = await supabaseAdmin
      .from("gw_api_keys")
      .insert(keysToInsert)
      .select();

    if (keysError) throw new Error(`keys seed error: ${keysError.message}`);
    console.log(`[migrate] ✅ Seeded ${insertedKeys?.length} api_keys`);

    // Build key prefix → id map
    const keyIdByPrefix: Record<string, string> = {};
    insertedKeys?.forEach((k: { key_prefix: string; id: string }) => {
      keyIdByPrefix[k.key_prefix] = k.id;
    });

    // Build app name → id map for logs
    const appNameById: Record<string, string> = {
      "Indonesian Visas": appIdBySlug["indonesian-visas"],
      "Tropic Tech": appIdBySlug["tropic-tech"],
      "MyBusiness Website": appIdBySlug["mybusiness-website"],
      "MyBusiness Playstore": appIdBySlug["mybusiness-playstore"],
      "MyBusiness Appstore": appIdBySlug["mybusiness-appstore"],
    };

    // ── Seed usage_logs (14 days of synthetic data) ────────────────────────
    const providers = ["claude", "gpt", "gemini"];
    const taskTypes = ["text", "image", "audio", "embeddings"];
    const keyMapping = [
      { prefix: "sk_visas_a8f3", appName: "Indonesian Visas" },
      { prefix: "sk_tropic_7d2f", appName: "Tropic Tech" },
      { prefix: "sk_myweb_bc11", appName: "MyBusiness Website" },
      { prefix: "sk_myplay_910e", appName: "MyBusiness Playstore" },
      { prefix: "sk_mystore_3e4d", appName: "MyBusiness Appstore" },
    ];

    const logsToInsert: object[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      keyMapping.forEach((k) => {
        const isCommunity = k.prefix === "sk_mystore_3e4d";
        const callCount = isCommunity
          ? Math.floor(Math.random() * 3)
          : Math.floor(Math.random() * 6) + 3;
        for (let c = 0; c < callCount; c++) {
          const provider = providers[Math.floor(Math.random() * providers.length)];
          const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
          let tokens = Math.floor(Math.random() * 2500) + 200;
          if (taskType === "image") tokens = 1000;
          if (taskType === "audio") tokens = 500;
          const logDate = new Date(date);
          logDate.setHours(
            Math.floor(Math.random() * 24),
            Math.floor(Math.random() * 60)
          );
          logsToInsert.push({
            api_key_id: keyIdByPrefix[k.prefix],
            app_name: k.appName,
            provider,
            task_type: taskType,
            tokens_used: tokens,
            created_at: logDate.toISOString(),
          });
        }
      });
    }

    const { error: logsError } = await supabaseAdmin
      .from("gw_usage_logs")
      .insert(logsToInsert);
    if (logsError) throw new Error(`logs seed error: ${logsError.message}`);
    console.log(`[migrate] ✅ Seeded ${logsToInsert.length} usage_logs`);

    // ── Seed knowledge_documents ───────────────────────────────────────────
    const docsToInsert = [
      {
        client_app_id: appIdBySlug["indonesian-visas"],
        title: "Indonesian Visas - FAQ Kebijakan Pengembalian (Refund)",
        content: "Pengguna berhak mengajukan pengembalian dana 100% apabila dokumen permohonan visa ditolak secara resmi oleh Imigrasi Indonesia karena kesalahan teknis dari tim kami.",
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        client_app_id: appIdBySlug["tropic-tech"],
        title: "Tropic Tech - Panduan Integrasi API Klien",
        content: "Semua API Tropic Tech harus dipanggil menggunakan HTTPS. Endpoint produksi di-host di `api.tropictech.com/v1/`. Rate limit default adalah 120 request per menit per IP address.",
        created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        client_app_id: null,
        title: "MyBusiness Ecosystem - Aturan Tone of Voice AI",
        content: "Semua asisten AI di seluruh produk MyBusiness harus mematuhi panduan kepribadian ini: Nada Bicara: Profesional, bersahabat, ringkas, dan jujur.",
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const { error: docsError } = await supabaseAdmin
      .from("gw_knowledge_documents")
      .insert(docsToInsert);
    if (docsError) throw new Error(`docs seed error: ${docsError.message}`);
    console.log(`[migrate] ✅ Seeded ${docsToInsert.length} knowledge_documents`);

    console.log("[migrate] 🎉 Database seeded successfully from initial data!");
  } catch (err) {
    console.error("[migrate] ❌ Seed migration failed:", err);
  }
}
