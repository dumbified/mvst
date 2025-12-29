import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedAnonClient: SupabaseClient | null = null;
let cachedServiceClient: SupabaseClient | null = null;

/**
 * Get Supabase client with anon key (respects RLS policies)
 * Use this for client-side operations
 */
export function getSupabase(): SupabaseClient {
  if (cachedAnonClient) return cachedAnonClient;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env. Define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  cachedAnonClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedAnonClient;
}

/**
 * Get Supabase client with service role key (bypasses RLS policies)
 * Use this for server-side operations that need to bypass RLS
 * Falls back to anon client if service role key is not configured
 */
export function getSupabaseServiceRole(): SupabaseClient | null {
  if (!supabaseUrl) {
    return null;
  }

  // If service role key is configured, use it
  if (supabaseServiceRoleKey) {
    if (cachedServiceClient) return cachedServiceClient;
    cachedServiceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return cachedServiceClient;
  }

  // Fallback to anon client if service role is not configured
  return getSupabase();
}

