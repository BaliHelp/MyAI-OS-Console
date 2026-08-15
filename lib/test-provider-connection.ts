// Shared by app/api/provider-keys/test/route.ts and .../test-all/route.ts so both
// "Uji Koneksi" (single) and "Uji Semua Koneksi" (bulk) buttons stay consistent.

import { GEMINI_PRIMARY_MODEL } from "./provider-adapters/gemini";
import { GPT_DEFAULT_MODEL } from "./provider-adapters/gpt";
import { CLAUDE_DEFAULT_MODEL } from "./provider-adapters/claude";
import { GROK_DEFAULT_MODEL } from "./provider-adapters/grok";
import { DEEPSEEK_DEFAULT_MODEL } from "./provider-adapters/deepseek";

export interface ConnectionTestResult {
  connected: boolean;
  details: string;
}

// 15s rather than a tighter budget: provider APIs occasionally take 10-20s even for a trivial
// /models listing under transient load (observed with OpenAI) — a short timeout turns "just
// slow" into a false "disconnected" report, exactly the kind of misleading status this test
// exists to prevent.
const TIMEOUT_MS = 15000;

async function checkModelsList(
  url: string,
  headers: Record<string, string>
): Promise<{ ok: boolean; errorDetail: string }> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) return { ok: true, errorDetail: "" };
    const json = await res.json().catch(() => ({}));
    return { ok: false, errorDetail: json.error?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, errorDetail: err.message || "Timeout/Error" };
  }
}

/**
 * For OpenAI-compatible custom providers (GLM/Kimi, OpenRouter, or any other
 * base_url), the /models list only proves the key authenticates — it says
 * nothing about whether the specific `model_name` configured for real chat
 * traffic actually exists or is billable. A key can show "connected" here
 * while every real gateway request fails (wrong model id, suspended account,
 * etc — see: GLM Kimi key showing "Terkoneksi" while chat completions
 * returned insufficient_quota_error from Moonshot's API).
 *
 * So for these providers we run a second, real chat-completion probe using
 * the exact same default-model fallback the production adapter
 * (lib/provider-adapters/custom-openai-compatible.ts) uses, and only report
 * connected:true when BOTH the key and the actual configured model work.
 */
async function testCustomOpenAiCompatible(
  rawKey: string,
  baseUrl: string | null,
  modelName: string | null
): Promise<ConnectionTestResult> {
  const root = (baseUrl || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const modelsUrl = root.endsWith("/chat/completions")
    ? root.replace("/chat/completions", "/models")
    : `${root}/models`;
  const chatUrl = root.endsWith("/chat/completions") ? root : `${root}/chat/completions`;
  const headers = {
    Authorization: `Bearer ${rawKey}`,
    "HTTP-Referer": "https://console.myai.nexus",
    "X-Title": "MyAI OS Console Gateway",
  };

  const modelsCheck = await checkModelsList(modelsUrl, headers);
  if (!modelsCheck.ok) {
    return { connected: false, details: `Key tidak valid: ${modelsCheck.errorDetail}` };
  }

  // Same fallback the real gateway route uses — keeps the test representative
  // of what a live chat request would actually receive.
  const effectiveModel = modelName || "google/gemini-2.5-flash";
  try {
    const res = await fetch(chatUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: effectiveModel,
        messages: [{ role: "user", content: "OK" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      return { connected: true, details: `Key & model OK (model: ${effectiveModel})` };
    }
    const json = await res.json().catch(() => ({}));
    const errorMsg = json.error?.message || `HTTP ${res.status}`;
    return { connected: false, details: `Key valid, tapi model '${effectiveModel}' gagal: ${errorMsg}` };
  } catch (err: any) {
    return { connected: false, details: `Key valid, tapi tes model gagal: ${err.message || "Timeout/Error"}` };
  }
}

/**
 * Real chat-completion probes for the 5 built-in providers, mirroring the pattern above.
 *
 * Before this, native providers only ran a /models reachability check (checkModelsList) — which
 * is exactly what let a fully dead model ("gemini-2.5-flash-lite" 404ing as "no longer available
 * to new users") show green in the dashboard while every real request failed. Each function here
 * hits the provider's actual chat-completion endpoint with the same default-model resolution the
 * production adapter uses, so "Terkoneksi" can never again mean anything less than "a real
 * completion request against the configured model just succeeded."
 */

async function testGemini(rawKey: string, modelName: string | null): Promise<ConnectionTestResult> {
  // Deliberately does NOT reuse the adapter's primary->fallback cascade — testing the cascade
  // would let a dead primary hide behind a live fallback, silently recreating the exact blind
  // spot this fix exists to close. Only the single resolved model is probed.
  const effectiveModel = modelName || GEMINI_PRIMARY_MODEL;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${rawKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "OK" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (res.ok) return { connected: true, details: `Key & model OK (model: ${effectiveModel})` };
    const json = await res.json().catch(() => ({}));
    const errorMsg = json.error?.message || `HTTP ${res.status}`;
    return { connected: false, details: `Key valid, tapi model '${effectiveModel}' gagal: ${errorMsg}` };
  } catch (err: any) {
    return { connected: false, details: `Tes model gagal: ${err.message || "Timeout/Error"}` };
  }
}

async function testGpt(rawKey: string, modelName: string | null): Promise<ConnectionTestResult> {
  const effectiveModel = modelName || GPT_DEFAULT_MODEL;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${rawKey}` },
      body: JSON.stringify({ model: effectiveModel, messages: [{ role: "user", content: "OK" }], max_tokens: 5 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { connected: true, details: `Key & model OK (model: ${effectiveModel})` };
    const json = await res.json().catch(() => ({}));
    const errorMsg = json.error?.message || `HTTP ${res.status}`;
    return { connected: false, details: `Key valid, tapi model '${effectiveModel}' gagal: ${errorMsg}` };
  } catch (err: any) {
    return { connected: false, details: `Tes model gagal: ${err.message || "Timeout/Error"}` };
  }
}

async function testClaude(rawKey: string, modelName: string | null): Promise<ConnectionTestResult> {
  const effectiveModel = modelName || CLAUDE_DEFAULT_MODEL;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": rawKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: effectiveModel,
        max_tokens: 5,
        messages: [{ role: "user", content: "OK" }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { connected: true, details: `Key & model OK (model: ${effectiveModel})` };
    const json = await res.json().catch(() => ({}));
    const errorMsg = json.error?.message || json.error?.type || `HTTP ${res.status}`;
    return { connected: false, details: `Key valid, tapi model '${effectiveModel}' gagal: ${errorMsg}` };
  } catch (err: any) {
    return { connected: false, details: `Tes model gagal: ${err.message || "Timeout/Error"}` };
  }
}

async function testGrok(rawKey: string, modelName: string | null): Promise<ConnectionTestResult> {
  const effectiveModel = modelName || GROK_DEFAULT_MODEL;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${rawKey}` },
      body: JSON.stringify({ model: effectiveModel, messages: [{ role: "user", content: "OK" }], max_tokens: 5 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { connected: true, details: `Key & model OK (model: ${effectiveModel})` };
    const json = await res.json().catch(() => ({}));
    // x.ai returns {code, error: "<string>"} on failure, not {error:{message}} — handle both.
    const errorMsg =
      json.error?.message || (typeof json.error === "string" ? json.error : null) || `HTTP ${res.status}`;
    return { connected: false, details: `Key valid, tapi model '${effectiveModel}' gagal: ${errorMsg}` };
  } catch (err: any) {
    return { connected: false, details: `Tes model gagal: ${err.message || "Timeout/Error"}` };
  }
}

async function testDeepseek(rawKey: string, modelName: string | null): Promise<ConnectionTestResult> {
  const effectiveModel = modelName || DEEPSEEK_DEFAULT_MODEL;
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${rawKey}` },
      body: JSON.stringify({ model: effectiveModel, messages: [{ role: "user", content: "OK" }], max_tokens: 5 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { connected: true, details: `Key & model OK (model: ${effectiveModel})` };
    const json = await res.json().catch(() => ({}));
    const errorMsg = json.error?.message || `HTTP ${res.status}`;
    return { connected: false, details: `Key valid, tapi model '${effectiveModel}' gagal: ${errorMsg}` };
  } catch (err: any) {
    return { connected: false, details: `Tes model gagal: ${err.message || "Timeout/Error"}` };
  }
}

export async function testProviderConnection(
  provider: string,
  rawKey: string,
  baseUrl: string | null,
  modelName: string | null
): Promise<ConnectionTestResult> {
  if (provider === "others" || provider === "custom_openai") {
    return testCustomOpenAiCompatible(rawKey, baseUrl, modelName);
  }
  if (provider === "gemini") return testGemini(rawKey, modelName);
  if (provider === "gpt") return testGpt(rawKey, modelName);
  if (provider === "claude") return testClaude(rawKey, modelName);
  if (provider === "grok") return testGrok(rawKey, modelName);
  if (provider === "deepseek") return testDeepseek(rawKey, modelName);

  return { connected: false, details: `Unsupported provider: ${provider}` };
}
