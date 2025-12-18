'use client';

import type { PlatformKey } from "../core/constants";
import { loadJsonFromStorage, saveJsonToStorage } from "./supabaseStorage";

const SETTINGS_BUCKET = process.env.NEXT_PUBLIC_WATERFALL_STATE_BUCKET ?? "uploads";
const SETTINGS_PATH = "shared/settings.json";

export type AppSettings = {
  partNumberToPlatform: Record<string, PlatformKey>;
  bomCosts: Record<string, number>;
  updatedAt: string;
};

export async function loadSettings(): Promise<AppSettings | null> {
  return loadJsonFromStorage<AppSettings>(SETTINGS_BUCKET, SETTINGS_PATH);
}

export async function saveSettings(settings: AppSettings): Promise<boolean> {
  return saveJsonToStorage(SETTINGS_BUCKET, SETTINGS_PATH, settings);
}

