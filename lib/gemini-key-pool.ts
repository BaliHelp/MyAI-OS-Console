/**
 * Smart Gemini Key Pool
 *
 * Manages a pool of Gemini API keys with:
 *  - LRU rotation (least-recently-used key goes first)
 *  - Per-key 429 cooldown tracking with exponential backoff
 *  - Instant intra-provider failover (try next key before giving up tier)
 *  - Quota estimation via usage_count tracking
 *  - Sources keys from BOTH Supabase DB and env vars (GEMINI_API_KEY_1..10)
 */

import { supabaseAdmin } from "@/lib/supabase";
import { decryptKey } from "@/lib/crypto";

export interface GeminiKeyCandidate {
  id: string | null;          // null = env-var key (no DB row)
  apiKey: string;
  label: string;
  usageCount: number;
  lastUsedAt: string | null;
  cooldownUntil: string | null;
  consecutive429: number;
}

/** In-memory cache: refreshed every CACHE_TTL_MS or on explicit invalidation */
let _cache: GeminiKeyCandidate[] = [];
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Load all available Gemini keys from DB + env vars.
 * Merges both sources, deduplicating by key value.
 */
export async function loadGeminiPool(force = false): Promise<GeminiKeyCandidate[]> {
  const now = Date.now();
  if (!force && _cache.length > 0 && now - _cacheLoadedAt < CACHE_TTL_MS) {
    return _cache;
  }

  const keys: GeminiKeyCandidate[] = [];
  const seenKeys = new Set<string>();

  // ── 1. Load from Supabase DB ────────────────────────────────────────────────
  if (supabaseAdmin) {
    try {
      const { data: dbKeys } = await supabaseAdmin
        .from("gw_provider_keys")
        .select("id, key_encrypted, label, usage_count, last_used_at, cooldown_until, consecutive_429_count")
        .eq("provider", "gemini")
        .eq("status", "active");

      for (const k of dbKeys ?? []) {
        try {
          const raw = decryptKey(k.key_encrypted);
          if (!raw || raw.includes("placeholder") || raw.includes("<")) continue;
          if (seenKeys.has(raw)) continue;
          seenKeys.add(raw);
          keys.push({
            id: k.id,
            apiKey: raw,
            label: k.label || "Gemini DB Key",
            usageCount: k.usage_count ?? 0,
            lastUsedAt: k.last_used_at,
            cooldownUntil: k.cooldown_until,
            consecutive429: k.consecutive_429_count ?? 0,
          });
        } catch { /* decrypt error, skip */ }
      }
    } catch (err) {
      console.warn("[gemini-pool] DB load error:", err);
    }
  }

  // ── 2. Load from environment variables (GEMINI_API_KEY_1..10 + legacy) ──────
  for (let i = 1; i <= 10; i++) {
    const raw =
      process.env[`GEMINI_API_KEY_${i}`] ||
      (i === 1 ? (process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY) : undefined);
    if (!raw || raw.trim() === "" || raw.includes("placeholder")) continue;
    if (seenKeys.has(raw.trim())) continue;
    seenKeys.add(raw.trim());
    keys.push({
      id: null,
      apiKey: raw.trim(),
      label: `Gemini Env Key ${i}`,
      usageCount: 0,
      lastUsedAt: null,
      cooldownUntil: null,
      consecutive429: 0,
    });
  }

  _cache = keys;
  _cacheLoadedAt = Date.now();
  return keys;
}

/**
 * Returns all keys that are currently available (not in active cooldown).
 * Sorts by LRU: oldest last_used_at first, then lowest usage_count.
 * Auto-resets expired cooldowns in DB.
 */
export async function getAvailableGeminiKeys(): Promise<GeminiKeyCandidate[]> {
  const pool = await loadGeminiPool();
  const now = new Date();

  // Auto-reset expired cooldowns in DB (async, non-blocking)
  const expiredIds = pool
    .filter(k => k.id && k.cooldownUntil && new Date(k.cooldownUntil) <= now)
    .map(k => k.id as string);

  if (expiredIds.length > 0 && supabaseAdmin) {
    (async () => {
      try {
        await supabaseAdmin
          .from("gw_provider_keys")
          .update({ cooldown_until: null, consecutive_429_count: 0 })
          .in("id", expiredIds);
        for (const k of _cache) {
          if (k.id && expiredIds.includes(k.id)) {
            k.cooldownUntil = null;
            k.consecutive429 = 0;
          }
        }
      } catch { /* ignore */ }
    })();
  }

  const available = pool.filter(k => {
    if (!k.cooldownUntil) return true;
    return new Date(k.cooldownUntil) <= now;
  });

  // LRU sort: never-used first, then oldest lastUsedAt, then lowest usageCount
  available.sort((a, b) => {
    if (!a.lastUsedAt && b.lastUsedAt) return -1;
    if (a.lastUsedAt && !b.lastUsedAt) return 1;
    if (a.lastUsedAt && b.lastUsedAt) {
      const diff = new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime();
      if (diff !== 0) return diff;
    }
    return a.usageCount - b.usageCount;
  });

  return available;
}

/** After a successful call: update usage stats in DB + cache. */
export async function markGeminiKeySuccess(key: GeminiKeyCandidate): Promise<void> {
  const cached = _cache.find(k => k.apiKey === key.apiKey);
  if (cached) {
    cached.usageCount += 1;
    cached.lastUsedAt = new Date().toISOString();
    cached.consecutive429 = 0;
    cached.cooldownUntil = null;
  }
  if (key.id && supabaseAdmin) {
    await supabaseAdmin
      .from("gw_provider_keys")
      .update({
        usage_count: key.usageCount + 1,
        last_used_at: new Date().toISOString(),
        consecutive_429_count: 0,
        cooldown_until: null,
      })
      .eq("id", key.id);
  }
}

/**
 * After a 429/quota error: apply exponential backoff cooldown.
 * Base: 60s, doubles each consecutive hit, capped at 1 hour.
 * Returns cooldown duration in seconds.
 */
export async function markGeminiKey429(key: GeminiKeyCandidate): Promise<number> {
  const consecutive = key.consecutive429;
  const baseSecs = 60;
  const durationSecs = Math.min(baseSecs * Math.pow(2, Math.min(consecutive, 5)), 3600);
  const cooldownUntil = new Date(Date.now() + durationSecs * 1000).toISOString();

  const cached = _cache.find(k => k.apiKey === key.apiKey);
  if (cached) {
    cached.consecutive429 = consecutive + 1;
    cached.cooldownUntil = cooldownUntil;
  }
  if (key.id && supabaseAdmin) {
    await supabaseAdmin
      .from("gw_provider_keys")
      .update({
        cooldown_until: cooldownUntil,
        consecutive_429_count: consecutive + 1,
      })
      .eq("id", key.id);
  }

  console.warn(
    `[gemini-pool] "${key.label}" hit 429 (streak #${consecutive + 1}). ` +
    `Cooldown: ${durationSecs}s until ${cooldownUntil}`
  );
  return durationSecs;
}

/** After a 401/403: permanently disable the key. */
export async function markGeminiKeyInvalid(key: GeminiKeyCandidate): Promise<void> {
  _cache = _cache.filter(k => k.apiKey !== key.apiKey);
  if (key.id && supabaseAdmin) {
    await supabaseAdmin
      .from("gw_provider_keys")
      .update({ status: "disabled" })
      .eq("id", key.id);
    console.warn(`[gemini-pool] "${key.label}" disabled (401/403).`);
  }
}

/** Force-refresh the in-memory cache on next call. */
export function invalidateGeminiPoolCache(): void {
  _cacheLoadedAt = 0;
}
