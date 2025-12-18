'use client';

import { SalesOrderSummary } from "./salesOrders";
import { ForecastSummary } from "./forecasts";
import { loadJsonFromStorage, saveJsonToStorage } from "./supabaseStorage";

const STATE_BUCKET = process.env.NEXT_PUBLIC_WATERFALL_STATE_BUCKET ?? "uploads";
const STATE_PATH = "shared/waterfall-state.json";

export type SharedWaterfallState = {
  salesOrdersList: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
  bomCosts?: Record<string, number>;
  updatedAt: string;
};

export async function loadSharedWaterfallState(): Promise<SharedWaterfallState | null> {
  return loadJsonFromStorage<SharedWaterfallState>(STATE_BUCKET, STATE_PATH);
}

export async function saveSharedWaterfallState(state: SharedWaterfallState): Promise<boolean> {
  return saveJsonToStorage(STATE_BUCKET, STATE_PATH, state);
}

