'use client';

import { getSupabase } from "./supabaseClient";
import { SalesOrderSummary } from "./salesOrders";
import { ForecastSummary } from "./forecasts";

const STATE_BUCKET = process.env.NEXT_PUBLIC_WATERFALL_STATE_BUCKET ?? "uploads";
const STATE_PATH = "shared/waterfall-state.json";

export type SharedWaterfallState = {
  salesOrdersList: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
  updatedAt: string;
};

const isNotFoundError = (error: { message?: string }) => {
  if (!error?.message) return false;
  return /not found/i.test(error.message) || /No such file or directory/i.test(error.message);
};

export async function loadSharedWaterfallState(): Promise<SharedWaterfallState | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(STATE_BUCKET).download(STATE_PATH);
    if (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
    const text = await data.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn("Failed to load shared state", err);
    return null;
  }
}

export async function saveSharedWaterfallState(state: SharedWaterfallState) {
  const supabase = getSupabase();
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
  const { error } = await supabase.storage
    .from(STATE_BUCKET)
    .upload(STATE_PATH, blob, { upsert: true, contentType: "application/json" });
  if (error) {
    throw error;
  }
}

