'use client';

import { useEffect, useState, useCallback } from "react";
import { loadSettings, type AppSettings } from "../lib/storage/settingsStorage";
import { PART_NUMBER_TO_PLATFORM, DEFAULT_BOM_COSTS } from "../lib/core/constants";

// Module-level cache for settings
let settingsCache: AppSettings | null = null;
let settingsLoaded = false;
const settingsListeners: Set<() => void> = new Set();

export function getCachedSettings(): AppSettings | null {
  return settingsCache;
}

export function setCachedSettings(settings: AppSettings | null) {
  settingsCache = settings;
  settingsLoaded = true;
  // Notify all listeners that settings have changed
  settingsListeners.forEach(listener => listener());
}

/**
 * Hook to load settings and cache them
 */
export function useSettings() {
  const [loading, setLoading] = useState(!settingsLoaded);
  const [settings, setSettings] = useState<AppSettings | null>(settingsCache);

  // Function to reload settings from Supabase
  const refreshSettings = useCallback(async () => {
    setLoading(true);
    try {
      const loadedSettings = await loadSettings();
      if (loadedSettings) {
        setCachedSettings(loadedSettings);
        setSettings(loadedSettings);
      } else {
        // Cache defaults
        const defaultSettings = {
          partNumberToPlatform: PART_NUMBER_TO_PLATFORM,
          bomCosts: DEFAULT_BOM_COSTS,
          googleSheetsUrl: undefined,
          googleSheetName: undefined,
          updatedAt: new Date().toISOString(),
        };
        setCachedSettings(defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      // Cache defaults on error
      const defaultSettings = {
        partNumberToPlatform: PART_NUMBER_TO_PLATFORM,
        bomCosts: DEFAULT_BOM_COSTS,
        updatedAt: new Date().toISOString(),
      };
      setCachedSettings(defaultSettings);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Set up listener for cache changes
    const listener = () => {
      setSettings(settingsCache);
    };
    settingsListeners.add(listener);

    // Initial load if not already loaded
    if (!settingsLoaded) {
      refreshSettings();
    } else {
      setSettings(settingsCache);
      setLoading(false);
    }

    return () => {
      settingsListeners.delete(listener);
    };
  }, [refreshSettings]);

  return { loading, settings, refreshSettings };
}



