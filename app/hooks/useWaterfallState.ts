import { useEffect, useState, useCallback } from "react";
import { SalesOrderSummary } from "../lib/data/salesOrders";
import { ForecastSummary } from "../lib/data/forecasts";
import { loadSharedWaterfallState, saveSharedWaterfallState, type CellComments } from "../lib/storage/stateStorage";
import { sortPeriodsByUploadDate } from "../lib/utils/dateUtils";
import { DEFAULT_BOM_COSTS } from "../lib/core/constants";
import { getLocalStorageTimestamp, setLocalStorageTimestamp } from "../lib/storage/localStorageUtils";
import { assignMissingIds } from "../lib/utils/uploadIdUtils";

/**
 * Hook to manage waterfall state (sales orders, forecasts, BOM costs)
 * Handles loading from localStorage and remote storage, merging, and persistence
 */
export function useWaterfallState() {
  const [salesOrdersList, setSalesOrdersList] = useState<SalesOrderSummary[]>([]);
  const [forecastSummaryList, setForecastSummaryList] = useState<ForecastSummary[]>([]);
  const [bomCosts, setBomCosts] = useState<Record<string, number>>(DEFAULT_BOM_COSTS);
  const [cellComments, setCellComments] = useState<CellComments>({});

  // Load saved data on mount (merge remote and local, prefer most complete)
  useEffect(() => {
    let cancelled = false;
    const loadState = async () => {
      // Load local storage first (faster, more reliable)
      let localSales: SalesOrderSummary[] = [];
      let localForecasts: ForecastSummary[] = [];
      let localBomCosts: Record<string, number> | null = null;
      let localCellComments: CellComments = {};
      
      try {
        const soJson = localStorage.getItem("mvst_salesOrdersList");
        const fcJson = localStorage.getItem("mvst_forecastSummary");
        const bomJson = localStorage.getItem("mvst_bom_costs");
        const commentsJson = localStorage.getItem("mvst_cellComments");
        if (soJson) {
          const parsed = JSON.parse(soJson);
          if (Array.isArray(parsed)) {
            localSales = parsed;
          }
        }
        if (fcJson) {
          const parsed = JSON.parse(fcJson);
          if (Array.isArray(parsed)) {
            localForecasts = parsed;
          } else if (parsed && typeof parsed === "object" && parsed.uploadDateLabel) {
            localForecasts = [parsed];
          }
        }
        if (bomJson) {
          const parsed = JSON.parse(bomJson);
          if (parsed && typeof parsed === "object") {
            localBomCosts = parsed;
          }
        }
        if (commentsJson) {
          const parsed = JSON.parse(commentsJson);
          if (parsed && typeof parsed === "object") {
            localCellComments = parsed;
          }
        }
      } catch {
        // ignore storage errors
      }

      // Try to load remote state
      const remote = await loadSharedWaterfallState();
      if (cancelled) return;

      // Merge remote and local data, deduplicating by uploadDateLabel
      // Prefer remote data if it exists and has a valid updatedAt timestamp
      const mergeLists = <T extends { uploadDateLabel: string }>(
        local: T[],
        remote: T[] | undefined,
        remoteUpdatedAt?: string
      ): T[] => {
        if (!remote || remote.length === 0) return local;
        
        const localUpdatedAt = getLocalStorageTimestamp();
        const preferRemote = remoteUpdatedAt && (!localUpdatedAt || remoteUpdatedAt > localUpdatedAt);
        
        if (preferRemote) {
          // If remote is newer, use ONLY remote data (don't merge in stale local data)
          // This ensures deletions and updates in remote are respected
          return [...remote];
        } else {
          // If local is newer or equal, trust local entirely (remote may contain stale data)
          return [...local];
        }
      };

      const mergedSales = mergeLists(localSales, remote?.salesOrdersList, remote?.updatedAt);
      const mergedForecasts = mergeLists(localForecasts, remote?.forecastSummaryList, remote?.updatedAt);

      // Merge BOM costs (prefer newer timestamp)
      let mergedBomCosts: Record<string, number> = { ...DEFAULT_BOM_COSTS };
      if (localBomCosts) {
        mergedBomCosts = { ...mergedBomCosts, ...localBomCosts };
      }
      if (remote?.bomCosts) {
        const localUpdatedAt = getLocalStorageTimestamp();
        const preferRemote = remote.updatedAt && (!localUpdatedAt || remote.updatedAt > localUpdatedAt);
        if (preferRemote) {
          mergedBomCosts = { ...DEFAULT_BOM_COSTS, ...remote.bomCosts };
        }
        // If local is newer, keep mergedBomCosts as-is (remote may be stale)
      }

      // Merge cell comments (prefer newer timestamp, but merge both)
      let mergedCellComments: CellComments = { ...localCellComments };
      if (remote?.cellComments) {
        const localUpdatedAt = getLocalStorageTimestamp();
        const preferRemote = remote.updatedAt && (!localUpdatedAt || remote.updatedAt > localUpdatedAt);
        if (preferRemote) {
          // Prefer remote, but keep local comments that don't exist in remote
          mergedCellComments = { ...localCellComments, ...remote.cellComments };
        } else {
          // Prefer local, but add remote comments that don't exist locally
          mergedCellComments = { ...remote.cellComments, ...localCellComments };
        }
      }

      // Sort by upload date
      const sortedSales = sortPeriodsByUploadDate(mergedSales);
      const sortedForecasts = sortPeriodsByUploadDate(mergedForecasts);

      // Assign IDs to uploads that don't have them (migration for existing data)
      const { salesOrdersList: salesWithIds, forecastSummaryList: forecastsWithIds } = assignMissingIds(
        sortedSales,
        sortedForecasts
      );

      if (cancelled) return;

      setSalesOrdersList(salesWithIds);
      setForecastSummaryList(forecastsWithIds);
      setBomCosts(mergedBomCosts);
      setCellComments(mergedCellComments);

      // If we merged data, assigned IDs, or it's different from what we loaded, save it back
      const idsChanged = salesWithIds.some((so, i) => so.id !== sortedSales[i]?.id) ||
        forecastsWithIds.some((fc, i) => fc.id !== sortedForecasts[i]?.id);
      
      if (remote && (mergedSales.length !== localSales.length || mergedForecasts.length !== localForecasts.length || 
          JSON.stringify(mergedBomCosts) !== JSON.stringify(localBomCosts || DEFAULT_BOM_COSTS) || 
          JSON.stringify(mergedCellComments) !== JSON.stringify(localCellComments) || idsChanged)) {
        saveSharedWaterfallState({
          salesOrdersList: salesWithIds,
          forecastSummaryList: forecastsWithIds,
          bomCosts: mergedBomCosts,
          cellComments: mergedCellComments,
          updatedAt: new Date().toISOString(),
        });
      }
    };
    loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist data whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("mvst_salesOrdersList", JSON.stringify(salesOrdersList));
    } catch {
      // ignore
    }
  }, [salesOrdersList]);

  useEffect(() => {
    try {
      localStorage.setItem("mvst_forecastSummary", JSON.stringify(forecastSummaryList));
    } catch {
      // ignore
    }
  }, [forecastSummaryList]);

  useEffect(() => {
    try {
      localStorage.setItem("mvst_cellComments", JSON.stringify(cellComments));
    } catch {
      // ignore
    }
  }, [cellComments]);

  const persistSharedState = useCallback(
    async (nextSales: SalesOrderSummary[], nextForecasts: ForecastSummary[], nextBomCosts?: Record<string, number>, nextCellComments?: CellComments) => {
      const updatedAt = new Date().toISOString();
      setLocalStorageTimestamp(updatedAt);
      await saveSharedWaterfallState({
        salesOrdersList: nextSales,
        forecastSummaryList: nextForecasts,
        bomCosts: nextBomCosts || bomCosts,
        cellComments: nextCellComments || cellComments,
        updatedAt,
      });
    },
    [bomCosts, cellComments],
  );

  return {
    salesOrdersList,
    setSalesOrdersList,
    forecastSummaryList,
    setForecastSummaryList,
    bomCosts,
    setBomCosts,
    cellComments,
    setCellComments,
    persistSharedState,
  };
}

