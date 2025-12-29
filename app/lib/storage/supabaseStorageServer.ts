import { getSupabase, getSupabaseServiceRole } from "./supabaseClientServer";

type StorageError = { 
  message?: string; 
  statusCode?: string | number;
  status?: string | number;
};

/**
 * Checks if Supabase is configured (server-side)
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Checks if an error is recoverable (e.g., file not found, permission denied)
 */
export function isRecoverableError(error: StorageError | null): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  const statusCode = error.statusCode || error.status;
  
  // Treat 400 (Bad Request) as recoverable - usually means RLS policy violation
  // Treat 403 (Forbidden) as recoverable - permission denied
  // Treat 404 (Not Found) as recoverable - file doesn't exist yet
  const recoverableStatusCodes = [400, 403, 404, '400', '403', '404'];
  
  return (
    recoverableStatusCodes.includes(statusCode as never) ||
    /not found/i.test(message) ||
    /no such file/i.test(message) ||
    /row-level security/i.test(message) ||
    /rls/i.test(message) ||
    /policy/i.test(message) ||
    /forbidden/i.test(message) ||
    /bad request/i.test(message)
  );
}

/**
 * Generic function to load JSON data from Supabase storage (server-side)
 */
export async function loadJsonFromStorage<T>(
  bucket: string,
  path: string
): Promise<T | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    // Try service role client first (bypasses RLS), fallback to anon client
    const supabaseService = getSupabaseServiceRole();
    const supabase = supabaseService || getSupabase();
    const { data, error } = await supabase.storage.from(bucket).download(path);
    
    if (error && !isRecoverableError(error)) {
      throw error;
    }
    
    if (!data) return null;
    
    const text = await data.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Generic function to save JSON data to Supabase storage (server-side)
 */
export async function saveJsonToStorage<T>(
  bucket: string,
  path: string,
  data: T
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    // Try service role client first (bypasses RLS), fallback to anon client
    const supabaseService = getSupabaseServiceRole();
    const supabase = supabaseService || getSupabase();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { upsert: true, contentType: "application/json" });
    
    if (error && !isRecoverableError(error)) {
      throw error;
    }
    
    return !error;
  } catch {
    return false;
  }
}

