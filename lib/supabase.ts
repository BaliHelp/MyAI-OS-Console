import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.GATEWAY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.GATEWAY_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "[supabase-admin] Missing GATEWAY_SUPABASE_URL or GATEWAY_SUPABASE_SERVICE_ROLE_KEY. " +
    "Server will operate in degraded mode without persistent storage."
  );
}

/**
 * Server-side Supabase admin client.
 * Uses SERVICE_ROLE_KEY — bypasses RLS. NEVER expose to client.
 * All server API routes use this client.
 */
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })
  : null;

export const isSupabaseReady = !!supabaseAdmin;
