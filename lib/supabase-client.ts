import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.GATEWAY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.GATEWAY_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser-side Supabase client (anon key).
 * Used only for client components that need direct Supabase access.
 * Most data fetching goes through Next.js API routes instead.
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
