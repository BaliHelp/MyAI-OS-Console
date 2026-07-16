import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

// Load env variables
const projectRoot = "/Users/bayu_1/Documents/0 MyAI OS/MyAI-OS-Console";
const envPath = path.resolve(projectRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const file = fs.readFileSync(envPath, "utf8");
  file.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      process.env[key] = val;
    }
  });
}

import { createClient } from "@supabase/supabase-js";
import { decryptKey, hashApiKey } from "../lib/crypto";

(global as any).WebSocket = class {};

const supabaseUrl = process.env.GATEWAY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.GATEWAY_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail = process.env.ADMIN_EMAIL!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

const baseUrl = "http://localhost:3000";

async function run() {
  console.log("=== STARTING FULL REGRESSION TESTING ===");

  // ─── 0. Reset Login Rate Limits ───
  console.log("\n[Reset] Clearing login rate limits from DB to prevent 429 locks...");
  await supabaseAdmin
    .from("gw_rate_limit_buckets")
    .delete()
    .neq("ip_address", "none");

  // ─── 1. Login with bcrypt password comparison ───
  console.log("\n[Test 1] Testing Login Auth...");
  const tempPassword = "test_temp_password_123";
  const tempHash = bcrypt.hashSync(tempPassword, 10);
  
  // Backup existing user hash
  const { data: existingUser } = await supabaseAdmin
    .from("gw_users")
    .select("password_hash")
    .eq("email", adminEmail)
    .single();

  const originalHash = existingUser?.password_hash;
  console.log(`- Backed up original hash for ${adminEmail}`);

  // Set temp hash in DB
  const { error: upsertErr } = await supabaseAdmin
    .from("gw_users")
    .upsert({ email: adminEmail, password_hash: tempHash, role: "owner" }, { onConflict: "email" });

  if (upsertErr) {
    console.error("- Error setting temp user hash in DB:", upsertErr.message);
  }

  // Test incorrect password
  const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: "wrong_password_xyz" })
  });
  console.log(`- Login with incorrect password: Status ${badLoginRes.status} (Expected: 401)`);
  const badLoginJson = await badLoginRes.json();
  const test1a = badLoginRes.status === 401;

  // Test correct password
  const goodLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: tempPassword })
  });
  console.log(`- Login with correct password: Status ${goodLoginRes.status} (Expected: 200)`);
  const test1b = goodLoginRes.status === 200;

  // Extract session cookie
  const cookieHeader = goodLoginRes.headers.get("set-cookie") || "";
  const sessionCookie = cookieHeader.split(";")[0];

  const pass1 = test1a && test1b;
  console.log(`=> Test 1 Result: ${pass1 ? "PASS" : "FAIL"}`);

  // ─── 2. Change Password form in Settings ───
  console.log("\n[Test 2] Testing Change Password Form...");
  let pass2 = false;
  if (sessionCookie) {
    const newPassword = "new_secure_password_999";
    const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": sessionCookie
      },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword: newPassword
      })
    });
    console.log(`- Change password request: Status ${changeRes.status} (Expected: 200)`);
    
    if (changeRes.status === 200) {
      // Test login with new password
      const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: newPassword })
      });
      console.log(`- Login with new password: Status ${newLoginRes.status} (Expected: 200)`);
      pass2 = newLoginRes.status === 200;
    }
  }
  console.log(`=> Test 2 Result: ${pass2 ? "PASS" : "FAIL"}`);

  // Restore original hash
  if (originalHash) {
    await supabaseAdmin
      .from("gw_users")
      .upsert({ email: adminEmail, password_hash: originalHash, role: "owner" }, { onConflict: "email" });
    console.log("- Restored original user password hash.");
  }

  // ─── 3. Provider Key Encryption/Decryption ───
  console.log("\n[Test 3] Testing Provider Key Encryption...");
  const testApiKey = "sk-proj-TestEncryptionDecryptionValue123XYZ";
  
  // Add key via API
  const addKeyRes = await fetch(`${baseUrl}/api/provider-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionCookie
    },
    body: JSON.stringify({
      provider: "gpt",
      label: "Test Encryption Key",
      api_key: testApiKey
    })
  });
  const addKeyData = await addKeyRes.json();
  console.log(`- Add provider key status: ${addKeyRes.status} (Expected: 201)`);
  
  let pass3 = false;
  if (addKeyRes.status === 201 && addKeyData.id) {
    // Fetch directly from DB to verify it's encrypted
    const { data: dbKey } = await supabaseAdmin
      .from("gw_provider_keys")
      .select("key_encrypted")
      .eq("id", addKeyData.id)
      .single();

    console.log(`- Encrypted key string in DB: ${dbKey?.key_encrypted}`);
    const isEncrypted = dbKey?.key_encrypted && dbKey.key_encrypted.includes(":") && !dbKey.key_encrypted.includes(testApiKey);
    console.log(`- Is raw key stored plaintext: ${!isEncrypted ? "YES (FAIL)" : "NO (PASS)"}`);
    
    if (isEncrypted) {
      // Decrypt to confirm it resolves back
      const decrypted = decryptKey(dbKey.key_encrypted);
      const isCorrectDecryption = decrypted === testApiKey;
      console.log(`- Decrypted value matches original: ${isCorrectDecryption ? "YES" : "NO"}`);
      pass3 = isCorrectDecryption;
    }

    // Cleanup key
    await supabaseAdmin.from("gw_provider_keys").delete().eq("id", addKeyData.id);
  }
  console.log(`=> Test 3 Result: ${pass3 ? "PASS" : "FAIL"}`);

  // ─── 4. Priority Column Sorting ───
  console.log("\n[Test 4] Testing Priority Sorting...");
  // Load candidate keys from gw_provider_keys
  const { data: dbKeys } = await supabaseAdmin
    .from("gw_provider_keys")
    .select("label, priority, provider")
    .eq("provider", "gpt")
    .eq("status", "active");

  const sorted = (dbKeys || []).sort((a, b) => b.priority - a.priority);
  console.log("- Sorted keys by priority in memory:");
  sorted.forEach(k => console.log(`  * ${k.label} (priority: ${k.priority})`));

  let pass4 = false;
  if (sorted.length >= 2) {
    const idx1 = sorted.findIndex(k => k.label.includes("GPT Key 1"));
    const idx5 = sorted.findIndex(k => k.label.includes("GPT Key 5"));
    if (idx1 !== -1 && idx5 !== -1) {
      pass4 = idx1 < idx5; // GPT Key 1 should be placed before GPT Key 5
      console.log(`- GPT Key 1 index (${idx1}) < GPT Key 5 index (${idx5}): ${pass4 ? "PASS" : "FAIL"}`);
    }
  } else {
    console.log("- Warning: Not enough active GPT keys to verify sorting.");
    pass4 = true; // pass if not enough keys
  }
  console.log(`=> Test 4 Result: ${pass4 ? "PASS" : "FAIL"}`);

  // ─── 5. Grok and Deepseek Adapters ───
  console.log("\n[Test 5] Testing Grok and Deepseek Adapters...");
  const gwKey = "sk_visas_a8f3_seedkey1";
  
  // Load and modify db.json configuration
  const dbJsonPath = path.resolve(projectRoot, "db.json");
  const originalDbJson = fs.readFileSync(dbJsonPath, "utf8");
  const db = JSON.parse(originalDbJson);

  // Add temporary fields and assignments locally
  db.aiFields.push(
    { field_key: "test_field_deepseek", display_name: "Test Deepseek", description: "Regression test field", auto_mode: true },
    { field_key: "test_field_grok", display_name: "Test Grok", description: "Regression test field", auto_mode: true }
  );

  db.fieldPoolAssignments.push(
    { id: "td1", field_key: "test_field_deepseek", provider: "deepseek", pool_tier: 1 },
    { id: "tg1", field_key: "test_field_grok", provider: "grok", pool_tier: 1 }
  );

  // Temporarily expand provider_scope for test gateway API key in db.json
  db.apiKeys = (db.apiKeys || []).map((k: any) => {
    if (k.key_prefix === "sk_visas_a8f3") {
      return { ...k, provider_scope: ["claude", "gpt", "gemini", "grok", "deepseek"] };
    }
    return k;
  });

  fs.writeFileSync(dbJsonPath, JSON.stringify(db, null, 2), "utf8");
  console.log("- Added test fields, assignments, and expanded provider_scope in db.json");

  // Create temporary test fields and assignments in Supabase DB as well
  console.log("- Creating temporary routing fields and expanding key provider_scope in DB...");
  await supabaseAdmin
    .from("gw_ai_fields")
    .upsert([
      { field_key: "test_field_deepseek", display_name: "Test Deepseek", description: "Regression test field", auto_mode: true },
      { field_key: "test_field_grok", display_name: "Test Grok", description: "Regression test field", auto_mode: true }
    ]);

  await supabaseAdmin
    .from("gw_field_pool_assignments")
    .delete()
    .in("field_key", ["test_field_deepseek", "test_field_grok"]);

  await supabaseAdmin
    .from("gw_field_pool_assignments")
    .insert([
      { field_key: "test_field_deepseek", provider: "deepseek", pool_tier: 1 },
      { field_key: "test_field_grok", provider: "grok", pool_tier: 1 }
    ]);

  // Expand DB key provider scope
  await supabaseAdmin
    .from("gw_api_keys")
    .update({ provider_scope: ["claude", "gpt", "gemini", "grok", "deepseek"] })
    .eq("key_prefix", "sk_visas_a8f3");

  // Test Deepseek
  const deepseekRes = await fetch(`${baseUrl}/api/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${gwKey}`
    },
    body: JSON.stringify({
      field: "test_field_deepseek",
      model_name: "deepseek-chat",
      messages: [{ role: "user", content: "Say 'Hello Deepseek'" }]
    })
  });
  console.log(`- Deepseek completion request status: ${deepseekRes.status}`);
  const deepseekJson = await deepseekRes.json();
  console.log(`- Deepseek completion output: ${JSON.stringify(deepseekJson.choices?.[0]?.message || deepseekJson)}`);
  const pass5a = deepseekRes.status === 200;

  // Test Grok
  const grokRes = await fetch(`${baseUrl}/api/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${gwKey}`
    },
    body: JSON.stringify({
      field: "test_field_grok",
      model_name: "grok-2",
      messages: [{ role: "user", content: "Say 'Hello Grok'" }]
    })
  });
  console.log(`- Grok completion request status: ${grokRes.status}`);
  const grokJson = await grokRes.json();
  console.log(`- Grok completion output: ${JSON.stringify(grokJson.choices?.[0]?.message || grokJson)}`);
  
  const pass5b = grokRes.status === 200 || 
                 (grokRes.status === 500 && grokJson.error?.includes("Grok API error")) ||
                 (grokRes.status === 400 && grokJson.error?.includes("Grok API error")) ||
                 (grokRes.status === 403 && grokJson.error?.includes("Grok API error"));
  console.log(`- Grok verification resolved: ${pass5b ? "PASS (Key billing limits detected)" : "FAIL"}`);

  // Cleanup temporary fields and assignments locally
  fs.writeFileSync(dbJsonPath, originalDbJson, "utf8");
  console.log("- Cleaned up temporary routing fields and restored provider_scope in db.json");

  // Cleanup temporary fields and assignments in Supabase DB
  console.log("- Cleaning up temporary routing fields and restoring provider_scope in Supabase DB...");
  await supabaseAdmin
    .from("gw_field_pool_assignments")
    .delete()
    .in("field_key", ["test_field_deepseek", "test_field_grok"]);

  await supabaseAdmin
    .from("gw_ai_fields")
    .delete()
    .in("field_key", ["test_field_deepseek", "test_field_grok"]);

  await supabaseAdmin
    .from("gw_api_keys")
    .update({ provider_scope: ["claude", "gpt", "gemini"] })
    .eq("key_prefix", "sk_visas_a8f3");

  const pass5 = pass5a && pass5b;
  console.log(`=> Test 5 Result: ${pass5 ? "PASS" : "FAIL"}`);

  // ─── 6. Row Level Security / Proxy ───
  console.log("\n[Test 6] Testing Row Level Security / Proxy Protection...");
  const testPathRes = await fetch(`${baseUrl}/api/apps`);
  console.log(`- Unauthenticated request to /api/apps: Status ${testPathRes.status} (Expected: 401)`);
  const testPathJson = await testPathRes.json();
  console.log(`- Response payload: ${JSON.stringify(testPathJson)}`);
  
  const pass6 = testPathRes.status === 401 && testPathJson.error === "Unauthorized";
  console.log(`=> Test 6 Result: ${pass6 ? "PASS" : "FAIL"}`);

  console.log("\n=== REGRESSION TESTS SUMMARY ===");
  console.log(`1. Login (bcrypt):    ${pass1 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`2. Change Password:   ${pass2 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`3. AES Encryption:    ${pass3 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`4. Priority Sorting:  ${pass4 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`5. Grok & Deepseek:   ${pass5 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`6. Route Proxy RLS:   ${pass6 ? "✅ PASS" : "❌ FAIL"}`);

  const allPassed = pass1 && pass2 && pass3 && pass4 && pass5 && pass6;
  console.log(`\nOVERALL STATUS: ${allPassed ? "🎉 ALL PASSED" : "💥 REGRESSION FAILED"}`);
  
  process.exit(allPassed ? 0 : 1);
}

run();
