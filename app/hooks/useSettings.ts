'use client';

import { useEffect, useState } from "react";
import { loadSettings, type AppSettings } from "../lib/settingsStorage";
import { PART_NUMBER_TO_PLATFORM, DEFAULT_BOM_COSTS } from "../lib/constants";

// Module-level cache for settings
let settingsCache: AppSettings | null = null;
let settingsLoaded = false;

export function getCachedSettings(): AppSettings | null {
  return settingsCache;
}

export function setCachedSettings(settings: AppSettings | null) {
  settingsCache = settings;
  settingsLoaded = true;
}

/**
 * Hook to load settings and cache them
 */
export function useSettings() {
  const [loading, setLoading] = useState(!settingsLoaded);

  useEffect(() => {
    if (settingsLoaded) {
      return;
    }

    const load = async () => {
      try {
        const settings = await loadSettings();
        if (settings) {
          setCachedSettings(settings);
        } else {
          // Cache defaults
          setCachedSettings({
            partNumberToPlatform: PART_NUMBER_TO_PLATFORM,
            bomCosts: DEFAULT_BOM_COSTS,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        // Cache defaults on error
        setCachedSettings({
          partNumberToPlatform: PART_NUMBER_TO_PLATFORM,
          bomCosts: DEFAULT_BOM_COSTS,
          updatedAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { loading, settings: settingsCache };
}



