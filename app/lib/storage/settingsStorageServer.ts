import { loadJsonFromStorage } from "./supabaseStorageServer";
import type { AppSettings } from "./settingsStorage";

const SETTINGS_BUCKET = process.env.NEXT_PUBLIC_WATERFALL_STATE_BUCKET ?? "uploads";
const SETTINGS_PATH = "shared/settings.json";

/**
 * Loads settings from Supabase storage (server-side)
 */
export async function loadSettingsServer(): Promise<AppSettings | null> {
  return loadJsonFromStorage<AppSettings>(SETTINGS_BUCKET, SETTINGS_PATH);
}

