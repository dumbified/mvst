'use client';

import { getSupabase } from "./supabaseClient";
import { SalesOrderSummary } from "./salesOrders";
import { ForecastSummary } from "./forecasts";

const STATE_BUCKET = process.env.NEXT_PUBLIC_WATERFALL_STATE_BUCKET ?? "uploads";
const STATE_PATH = "shared/waterfall-state.json";

export type SharedWaterfallState = {
  salesOrdersList: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
  bomCosts?: Record<string, number>;
  updatedAt: string;
};

type StorageError = { 
  message?: string; 
  statusCode?: string | number;
  status?: string | number;
};

const isSupabaseConfigured = (): boolean => {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
};

const isRecoverableError = (error: StorageError | null): boolean => {
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
};

export async function loadSharedWaterfallState(): Promise<SharedWaterfallState | null> {
  // Skip if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(STATE_BUCKET).download(STATE_PATH);
    
    if (error && !isRecoverableError(error)) {
      throw error;
    }
    
    if (!data) return null;
    
    const text = await data.text();
    return JSON.parse(text) as SharedWaterfallState;
  } catch {
    return null;
  }
}

export async function saveSharedWaterfallState(state: SharedWaterfallState): Promise<boolean> {
  // Skip if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const supabase = getSupabase();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const { error } = await supabase.storage
      .from(STATE_BUCKET)
      .upload(STATE_PATH, blob, { upsert: true, contentType: "application/json" });
    
    if (error && !isRecoverableError(error)) {
      throw error;
    }
    
    return !error;
  } catch {
    return false;
  }
}

