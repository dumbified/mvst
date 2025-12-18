/**
 * Shared constants across the application
 */

export type PlatformKey = "TH3K" | "TR3K" | "TRS+" | "THSE";

export const PLATFORM_LABELS: readonly PlatformKey[] = ["TH3K", "TR3K", "TRS+", "THSE"];

export const PART_NUMBER_TO_PLATFORM: Record<string, PlatformKey> = {
  "9300-ai001": "TH3K",
  "9301-ai001": "TH3K",
  "9300-ai002": "TR3K",
  "9301-ai002": "TR3K",
  "9300-i013": "TRS+",
  "9301-i013": "TRS+",
  "9300-i012": "THSE",
  "9300-i011": "TR3K",
  "9300-i010": "TH3K",
};

export const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const DEFAULT_BOM_COSTS: Record<string, number> = {
  TH3K: 583382,
  TR3K: 834063,
  THSE: 306667,
  "TRS+": 390193,
};

/**
 * Get settings-aware part number to platform mapping
 * Falls back to default constants if settings are not loaded
 */
export function getPartNumberToPlatform(): Record<string, PlatformKey> {
  // Try to import the cache (only works in client components)
  if (typeof window !== 'undefined') {
    try {
      // Dynamic import to avoid circular dependencies
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCachedSettings } = require('../hooks/useSettings');
      const settings = getCachedSettings();
      if (settings?.partNumberToPlatform) {
        return settings.partNumberToPlatform;
      }
    } catch {
      // Fall through to defaults
    }
  }
  return PART_NUMBER_TO_PLATFORM;
}

/**
 * Get settings-aware BOM costs
 * Falls back to default constants if settings are not loaded
 */
export function getBomCosts(): Record<string, number> {
  // Try to import the cache (only works in client components)
  if (typeof window !== 'undefined') {
    try {
      // Dynamic import to avoid circular dependencies
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCachedSettings } = require('../hooks/useSettings');
      const settings = getCachedSettings();
      if (settings?.bomCosts) {
        return settings.bomCosts;
      }
    } catch {
      // Fall through to defaults
    }
  }
  return DEFAULT_BOM_COSTS;
}

