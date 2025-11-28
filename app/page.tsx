'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import DemandWaterfallTable from "./components/DemandWaterfallTable";
import UploadControls from "./components/UploadControls";
import DatePickerDialog from "./components/DatePickerDialog";
import { SalesOrderSummary, parseSalesOrdersCsv, formatFullDate } from "./lib/salesOrders";
import { ForecastSummary, parseForecastCsv } from "./lib/forecasts";
import { uploadFileToSupabase } from "./lib/storage";
import { buildMonthsWindow, parseDateLabel, sortPeriodsByUploadDate } from "./lib/dateUtils";
import { useMonthFilter } from "./hooks/useMonthFilter";
import { loadSharedWaterfallState, saveSharedWaterfallState } from "./lib/stateStorage";

const DEFAULT_BOM_COSTS: Record<string, number> = {
  TH3K: 583382,
  TR3K: 834063,
  THSE: 306667,
  "TRS+": 390193,
};

export default function Home() {
  const [salesOrdersList, setSalesOrdersList] = useState<SalesOrderSummary[]>([]);
  const [forecastSummaryList, setForecastSummaryList] = useState<ForecastSummary[]>([]);
  const [bomCosts, setBomCosts] = useState<Record<string, number>>(DEFAULT_BOM_COSTS);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [editingDateLabel, setEditingDateLabel] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<Date | undefined>(undefined);
  const [editingAnchor, setEditingAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const bucketName = "uploads";

  // Load saved data on mount (merge remote and local, prefer most complete)
  useEffect(() => {
    let cancelled = false;
    const loadState = async () => {
      // Load local storage first (faster, more reliable)
      let localSales: SalesOrderSummary[] = [];
      let localForecasts: ForecastSummary[] = [];
      let localBomCosts: Record<string, number> | null = null;
      
      try {
        const soJson = localStorage.getItem("mvst_salesOrdersList");
        const fcJson = localStorage.getItem("mvst_forecastSummary");
        const bomJson = localStorage.getItem("mvst_bom_costs");
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
        
        // Get local storage timestamp for comparison
        let localUpdatedAt: string | null = null;
        try {
          const stateJson = localStorage.getItem("mvst_state_updatedAt");
          if (stateJson) {
            localUpdatedAt = JSON.parse(stateJson);
          }
        } catch {
          // ignore
        }
        
      // Prefer remote if it has a newer timestamp, otherwise prefer local
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
        // Get local storage timestamp for comparison
        let localUpdatedAt: string | null = null;
        try {
          const stateJson = localStorage.getItem("mvst_state_updatedAt");
          if (stateJson) {
            localUpdatedAt = JSON.parse(stateJson);
          }
        } catch {
          // ignore
        }
        // Prefer remote if it has a newer timestamp
        const preferRemote = remote.updatedAt && (!localUpdatedAt || remote.updatedAt > localUpdatedAt);
        if (preferRemote) {
          mergedBomCosts = { ...DEFAULT_BOM_COSTS, ...remote.bomCosts };
        }
        // If local is newer, keep mergedBomCosts as-is (remote may be stale)
      }

      // Sort by upload date
      const sortedSales = sortPeriodsByUploadDate(mergedSales);
      const sortedForecasts = sortPeriodsByUploadDate(mergedForecasts);

      setSalesOrdersList(sortedSales);
      setForecastSummaryList(sortedForecasts);
      setBomCosts(mergedBomCosts);

      // If we merged data and it's different from what we loaded, save it back
      if (remote && (mergedSales.length !== localSales.length || mergedForecasts.length !== localForecasts.length || JSON.stringify(mergedBomCosts) !== JSON.stringify(localBomCosts || DEFAULT_BOM_COSTS))) {
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

  const {
    fromMonth,
    toMonth,
    setFromMonth,
    setToMonth,
    availableMonths,
    filteredSalesOrdersList,
    filteredForecastSummaryList,
    hasActiveMonthFilter,
    filteredPeriodCount,
    totalPeriodCount,
    clearFilters,
  } = useMonthFilter<SalesOrderSummary, ForecastSummary>(salesOrdersList, forecastSummaryList);

  const persistSharedState = useCallback(
    async (nextSales: SalesOrderSummary[], nextForecasts: ForecastSummary[], nextBomCosts?: Record<string, number>) => {
      const updatedAt = new Date().toISOString();
      try {
        localStorage.setItem("mvst_state_updatedAt", JSON.stringify(updatedAt));
      } catch {
        // ignore
      }
      await saveSharedWaterfallState({
        salesOrdersList: nextSales,
        forecastSummaryList: nextForecasts,
        bomCosts: nextBomCosts || bomCosts,
        updatedAt,
      });
    },
    [bomCosts],
  );

  const handleSalesOrdersUpload = useCallback(
    async (file: File) => {
      try {
        await uploadFileToSupabase(bucketName, file, "sales-orders");
        const csvText = await file.text();
        const summary = parseSalesOrdersCsv(csvText, new Date());
        if (summary) {
          const nextSales = sortPeriodsByUploadDate([...salesOrdersList, summary]);
          setSalesOrdersList(nextSales);
          persistSharedState(nextSales, forecastSummaryList);
        }
      } catch (error) {
        console.error("Failed to process Sales Orders CSV", error);
      }
    },
    [bucketName, forecastSummaryList, persistSharedState, salesOrdersList],
  );

  const handleForecastUpload = useCallback(
    async (file: File) => {
      try {
        await uploadFileToSupabase(bucketName, file, "forecasts");
        const csvText = await file.text();
        const summary = parseForecastCsv(csvText, new Date());
        if (summary) {
          const nextForecasts = sortPeriodsByUploadDate([...forecastSummaryList, summary]);
          setForecastSummaryList(nextForecasts);
          persistSharedState(salesOrdersList, nextForecasts);
        }
      } catch (error) {
        console.error("Failed to process Forecast CSV", error);
      }
    },
    [bucketName, forecastSummaryList, persistSharedState, salesOrdersList],
  );

  const handleBomCostsChange = useCallback(
    async (newBomCosts: Record<string, number>) => {
      setBomCosts(newBomCosts);
      const updatedAt = new Date().toISOString();

      // Update localStorage immediately
      try {
        localStorage.setItem("mvst_bom_costs", JSON.stringify(newBomCosts));
        localStorage.setItem("mvst_state_updatedAt", JSON.stringify(updatedAt));
      } catch {
        // ignore
      }
      
      // Save to remote storage with updated timestamp
      const saved = await saveSharedWaterfallState({
        salesOrdersList,
        forecastSummaryList,
        bomCosts: newBomCosts,
        updatedAt,
      });
      
      // Save timestamp to localStorage for merge comparison
      if (saved) {
        try {
          localStorage.setItem("mvst_state_updatedAt", JSON.stringify(updatedAt));
        } catch {
          // ignore
        }
      }
    },
    [forecastSummaryList, salesOrdersList],
  );

  const handleDeleteByDate = useCallback(
    async (dateLabel: string) => {
      const nextSales = salesOrdersList.filter((so) => so.uploadDateLabel !== dateLabel);
      const nextForecasts = forecastSummaryList.filter((fc) => fc.uploadDateLabel !== dateLabel);
      
      // Update state immediately
      setSalesOrdersList(nextSales);
      setForecastSummaryList(nextForecasts);
      const updatedAt = new Date().toISOString();
      
      // Update localStorage immediately to prevent stale data on reload
      try {
        localStorage.setItem("mvst_salesOrdersList", JSON.stringify(nextSales));
        localStorage.setItem("mvst_forecastSummary", JSON.stringify(nextForecasts));
        localStorage.setItem("mvst_state_updatedAt", JSON.stringify(updatedAt));
      } catch {
        // ignore
      }
      
      // Save to remote storage with updated timestamp
      const saved = await saveSharedWaterfallState({
        salesOrdersList: nextSales,
        forecastSummaryList: nextForecasts,
        bomCosts,
        updatedAt,
      });
      
      // Save timestamp to localStorage for merge comparison
      if (!saved) {
        // If remote save failed, log error but keep local state
        console.error("Failed to save deleted state to remote storage");
      }
    },
    [bomCosts, forecastSummaryList, salesOrdersList],
  );

  useEffect(() => {
    if (!showFilterMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!filterMenuRef.current) return;
      if (!filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilterMenu]);

  const handleDateEdit = useCallback(
    (dateLabel: string, anchor?: { top: number; left: number; width: number; height: number }) => {
      if (datePickerOpen && editingDateLabel === dateLabel) {
        setDatePickerOpen(false);
        setEditingDateLabel(null);
        setEditingDate(undefined);
        setEditingAnchor(null);
        return;
      }

      // Find the current date from the label
      const currentDate = parseDateLabel(dateLabel);
      if (!currentDate) {
        console.error("Could not parse date from label:", dateLabel);
        return;
      }

      // Set up the date picker dialog
      setEditingDateLabel(dateLabel);
      setEditingDate(currentDate);
      setEditingAnchor(anchor ?? null);
      setDatePickerOpen(true);
    },
    [datePickerOpen, editingDateLabel]
  );

  const handleDateDelete = useCallback((dateLabel: string) => {
    handleDeleteByDate(dateLabel);
  }, [handleDeleteByDate]);

  const handleDateSelect = useCallback(
    (newDate: Date) => {
      if (!editingDateLabel) return;

      const months = buildMonthsWindow(newDate);
      const newDateLabel = formatFullDate(newDate);

      // If the new date is the same as the old date, do nothing
      if (newDateLabel === editingDateLabel) {
        setDatePickerOpen(false);
        setEditingDateLabel(null);
        setEditingDate(undefined);
        setEditingAnchor(null);
        return;
      }

      // Update forecasts: change the date label and remove any existing record with the new date
      const nextForecasts = sortPeriodsByUploadDate(
        forecastSummaryList
          .filter((fc) => fc.uploadDateLabel !== newDateLabel) // Remove any existing record with new date
          .map((fc) =>
            fc.uploadDateLabel === editingDateLabel
              ? {
                  ...fc,
                  uploadDateLabel: newDateLabel,
                  months,
                }
              : fc,
          ),
      );

      // Update sales orders: change the date label and remove any existing record with the new date
      const nextSales = sortPeriodsByUploadDate(
        salesOrdersList
          .filter((so) => so.uploadDateLabel !== newDateLabel) // Remove any existing record with new date
          .map((so) =>
            so.uploadDateLabel === editingDateLabel
              ? {
                  ...so,
                  uploadDateLabel: newDateLabel,
                  months,
                }
              : so,
          ),
      );

      setForecastSummaryList(nextForecasts);
      setSalesOrdersList(nextSales);
      const updatedAt = new Date().toISOString();
      
      // Update localStorage immediately to prevent stale data on reload
      try {
        localStorage.setItem("mvst_salesOrdersList", JSON.stringify(nextSales));
        localStorage.setItem("mvst_forecastSummary", JSON.stringify(nextForecasts));
        localStorage.setItem("mvst_state_updatedAt", JSON.stringify(updatedAt));
      } catch {
        // ignore
      }
      
      // Save with updated timestamp
      const saved = saveSharedWaterfallState({
        salesOrdersList: nextSales,
        forecastSummaryList: nextForecasts,
        bomCosts,
        updatedAt,
      });
      
      // Log if the save fails (timestamp already set optimistically)
      saved.then((success) => {
        if (!success) {
          console.error("Failed to save updated date to remote storage");
        }
      });

      setDatePickerOpen(false);
      setEditingDateLabel(null);
      setEditingDate(undefined);
      setEditingAnchor(null);
    },
    [bomCosts, editingDateLabel, forecastSummaryList, salesOrdersList],
  );

  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
      <header className="space-y-2">
        <h1 className="text-xl md:text-2xl font-semibold">MVS-T Demand Waterfall</h1>
      </header>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center gap-2" ref={filterMenuRef}>
            <button
              type="button"
              onClick={() => setShowFilterMenu((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 font-mono"
            >
              Filter by Month
            </button>
            {showFilterMenu ? (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg z-[5000]">
                <div className="flex flex-col gap-3 text-xs text-neutral-700">
                  <label className="flex flex-col gap-1">
                    <span>From</span>
                    <select
                      value={fromMonth}
                      onChange={(e) => setFromMonth(e.target.value)}
                      className="rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
                    >
                      <option value="">All months</option>
                      {availableMonths.map((month) => (
                        <option key={month.key} value={month.key}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>To</span>
                    <select
                      value={toMonth}
                      onChange={(e) => setToMonth(e.target.value)}
                      className="rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
                    >
                      <option value="">All months</option>
                      {availableMonths.map((month) => (
                        <option key={month.key} value={month.key}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-500">
                      {hasActiveMonthFilter
                        ? `Showing ${filteredPeriodCount} period${filteredPeriodCount === 1 ? "" : "s"}`
                        : `Showing all ${totalPeriodCount} period${totalPeriodCount === 1 ? "" : "s"}`}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                      onClick={clearFilters}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="ml-auto flex items-end justify-end gap-3 flex-wrap">
            <UploadControls
              onSalesOrdersUpload={handleSalesOrdersUpload}
              onForecastUpload={handleForecastUpload}
              editMode={editMode}
              onToggleEditMode={() => setEditMode((v) => !v)}
            />
          </div>
        </div>
        <div className="overflow-auto rounded-lg border border-neutral-200/60 bg-white">
          <DemandWaterfallTable
            salesOrdersList={filteredSalesOrdersList}
            forecastSummaryList={filteredForecastSummaryList}
            bomCosts={bomCosts}
            onBomCostsChange={handleBomCostsChange}
            editMode={editMode}
            onDateEdit={handleDateEdit}
            onDateDelete={handleDateDelete}
          />
        </div>
      </section>
      <DatePickerDialog
        open={datePickerOpen}
        onOpenChange={(open) => {
          setDatePickerOpen(open);
          if (!open) {
            // Reset editing state when dialog closes
            setEditingDateLabel(null);
            setEditingDate(undefined);
            setEditingAnchor(null);
          }
        }}
        date={editingDate}
        onDateSelect={handleDateSelect}
        anchor={editingAnchor ?? undefined}
      />
    </main>
  );
}
