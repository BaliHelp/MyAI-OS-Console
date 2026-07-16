import { supabaseAdmin } from "./supabase";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
}

/**
 * Supabase-backed sliding window rate limiter.
 * Uses the rate_limit_buckets table in gateway_console schema.
 * Works correctly across multiple Vercel/Cloud Run instances (shared state).
 *
 * If Supabase is not configured, falls back to allowing all requests.
 */
export async function checkRateLimit(
  ip: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Graceful fallback when Supabase not configured
  if (!supabaseAdmin) {
    return { allowed: true, remaining: config.maxRequests, resetAt: new Date() };
  }

  const windowStart = new Date(
    Date.now() - config.windowMinutes * 60 * 1000
  ).toISOString();

  try {
    // Try to get existing bucket
    const { data: existing } = await supabaseAdmin
      .from("gw_rate_limit_buckets")
      .select("*")
      .eq("ip_address", ip)
      .eq("endpoint", config.endpoint)
      .single();

    const resetAt = new Date(
      Date.now() + config.windowMinutes * 60 * 1000
    );

    if (!existing) {
      // First request — create bucket
      await supabaseAdmin.from("gw_rate_limit_buckets").insert({
        ip_address: ip,
        endpoint: config.endpoint,
        count: 1,
        window_start: new Date().toISOString(),
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }

    // Check if window has expired → reset
    if (existing.window_start < windowStart) {
      await supabaseAdmin
        .from("gw_rate_limit_buckets")
        .update({ count: 1, window_start: new Date().toISOString() })
        .eq("ip_address", ip)
        .eq("endpoint", config.endpoint);
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }

    // Within window — check count
    if (existing.count >= config.maxRequests) {
      const windowEndAt = new Date(
        new Date(existing.window_start).getTime() +
          config.windowMinutes * 60 * 1000
      );
      return { allowed: false, remaining: 0, resetAt: windowEndAt };
    }

    // Increment count
    await supabaseAdmin
      .from("gw_rate_limit_buckets")
      .update({ count: existing.count + 1 })
      .eq("ip_address", ip)
      .eq("endpoint", config.endpoint);

    return {
      allowed: true,
      remaining: config.maxRequests - existing.count - 1,
      resetAt,
    };
  } catch (err) {
    // On DB error, allow the request but log it
    console.error("[rate-limit] DB error, allowing request:", err);
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(),
    };
  }
}

// Pre-configured rate limit presets
export const RATE_LIMITS = {
  LOGIN: { endpoint: "auth/login", maxRequests: 5, windowMinutes: 15 },
  GEMINI: { endpoint: "gemini/query", maxRequests: 20, windowMinutes: 60 },
} as const;
