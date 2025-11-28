'use client';

import { useCallback, useEffect, useState } from "react";
import { SalesOrderSummary } from "../lib/salesOrders";
import { ForecastSummary } from "../lib/forecasts";
import { DEFAULT_BOM_COSTS } from "../lib/constants";
import {
  loadSalesOrdersFromLocalStorage,
  loadForecastsFromLocalStorage,
  loadBomCostsFromLocalStorage,
  saveSalesOrdersToLocalStorage,
  saveForecastsToLocalStorage,
  saveBomCostsToLocalStorage,
} from "../lib/localStorageUtils";
import { loadSharedWaterfallState, saveSharedWaterfallState } from "../lib/stateStorage";
import { sortPeriodsByUploadDate } from "../lib/dateUtils";

type PeriodRecord = { uploadDateLabel: string };

function mergeLists<T extends PeriodRecord>(
  local: T[],
  remote: T[] | undefined,
): T[] {
  if (!remote || remote.length === 0) return local;

  const localMap = new Map<string, T>();
  local.forEach((item) => {
    localMap.set(item.uploadDateLabel, item);
  });

  // Prefer remote if both exist (it's more recent)
  remote.forEach((item) => {
    localMap.set(item.uploadDateLabel, item);
  });

  return Array.from(localMap.values());
}

export function useWaterfallState() {
  const [salesOrdersList, setSalesOrdersList] = useState<SalesOrderSummary[]>([]);
  const [forecastSummaryList, setForecastSummaryList] = useState<ForecastSummary[]>([]);
  const [bomCosts, setBomCosts] = useState<Record<string, number>>(DEFAULT_BOM_COSTS);
  const [isLoading, setIsLoading] = useState(true);

  // Load state on mount
  useEffect(() => {
    let cancelled = false;
    const loadState = async () => {
      // Load from localStorage first (faster, more reliable)
      const localSales = loadSalesOrdersFromLocalStorage();
      const localForecasts = loadForecastsFromLocalStorage();
      const localBomCosts = loadBomCostsFromLocalStorage(DEFAULT_BOM_COSTS);

      // Try to load remote state
      const remote = await loadSharedWaterfallState();
      if (cancelled) return;

      // Merge remote and local data
      const mergedSales = mergeLists(localSales, remote?.salesOrdersList);
      const mergedForecasts = mergeLists(localForecasts, remote?.forecastSummaryList);
      const mergedBomCosts = remote?.bomCosts
        ? { ...DEFAULT_BOM_COSTS, ...remote.bomCosts }
        : localBomCosts;

      // Sort by upload date
      const sortedSales = sortPeriodsByUploadDate(mergedSales);
      const sortedForecasts = sortPeriodsByUploadDate(mergedForecasts);

      setSalesOrdersList(sortedSales);
      setForecastSummaryList(sortedForecasts);
      setBomCosts(mergedBomCosts);
      setIsLoading(false);

      // If we merged data and it's different, save it back
      if (
        remote &&
        (mergedSales.length !== localSales.length ||
          mergedForecasts.length !== localForecasts.length ||
          JSON.stringify(mergedBomCosts) !== JSON.stringify(localBomCosts))
      ) {
        saveSharedWaterfallState({
          salesOrdersList: sortedSales,
          forecastSummaryList: sortedForecasts,
          bomCosts: mergedBomCosts,
          updatedAt: new Date().toISOString(),
        });
      }
    };
    loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist to localStorage whenever data changes
  useEffect(() => {
    if (!isLoading) {
      saveSalesOrdersToLocalStorage(salesOrdersList);
    }
  }, [salesOrdersList, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveForecastsToLocalStorage(forecastSummaryList);
    }
  }, [forecastSummaryList, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveBomCostsToLocalStorage(bomCosts);
    }
  }, [bomCosts, isLoading]);

  const persistSharedState = useCallback(
    async (
      nextSales: SalesOrderSummary[],
      nextForecasts: ForecastSummary[],
      nextBomCosts?: Record<string, number>,
    ) => {
      await saveSharedWaterfallState({
        salesOrdersList: nextSales,
        forecastSummaryList: nextForecasts,
        bomCosts: nextBomCosts ?? bomCosts,
        updatedAt: new Date().toISOString(),
      });
    },
    [bomCosts],
  );

  return {
    salesOrdersList,
    forecastSummaryList,
    bomCosts,
    isLoading,
    setSalesOrdersList,
    setForecastSummaryList,
    setBomCosts,
    persistSharedState,
  };
}

