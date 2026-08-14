// Shared by app/api/provider-keys/test/route.ts and .../test-all/route.ts so both
// "Uji Koneksi" (single) and "Uji Semua Koneksi" (bulk) buttons stay consistent.

export interface ConnectionTestResult {
  connected: boolean;
  details: string;
}

const TIMEOUT_MS = 8000;

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

export async function testProviderConnection(
  provider: string,
  rawKey: string,
  baseUrl: string | null,
  modelName: string | null
): Promise<ConnectionTestResult> {
  if (provider === "others" || provider === "custom_openai") {
    return testCustomOpenAiCompatible(rawKey, baseUrl, modelName);
  }

  let url = "";
  let headers: Record<string, string> = {};
  if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models?key=${rawKey}`;
  } else if (provider === "gpt") {
    url = "https://api.openai.com/v1/models";
    headers = { Authorization: `Bearer ${rawKey}` };
  } else if (provider === "claude") {
    url = "https://api.anthropic.com/v1/models";
    headers = { "x-api-key": rawKey, "anthropic-version": "2023-06-01" };
  } else if (provider === "grok") {
    url = "https://api.x.ai/v1/models";
    headers = { Authorization: `Bearer ${rawKey}` };
  } else if (provider === "deepseek") {
    url = "https://api.deepseek.com/models";
    headers = { Authorization: `Bearer ${rawKey}` };
  } else {
    return { connected: false, details: `Unsupported provider: ${provider}` };
  }

  const check = await checkModelsList(url, headers);
  return check.ok
    ? { connected: true, details: "Koneksi sukses" }
    : { connected: false, details: `Gagal: ${check.errorDetail}` };
}
