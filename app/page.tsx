'use client';

import { useCallback, useRef, useState } from "react";
import DemandWaterfallTable from "./components/DemandWaterfallTable";
import UploadControls from "./components/UploadControls";
import DatePickerDialog from "./components/DatePickerDialog";
import { useMonthFilter } from "./hooks/useMonthFilter";
import { useWaterfallState } from "./hooks/useWaterfallState";
import { useWaterfallUploads } from "./hooks/useWaterfallUploads";
import { useDateEditor } from "./hooks/useDateEditor";
import { useClickOutside } from "./hooks/useClickOutside";
import { useSettings } from "./hooks/useSettings";
import { SalesOrderSummary } from "./lib/data/salesOrders";
import { ForecastSummary } from "./lib/data/forecasts";
import { loadSharedWaterfallState, saveSharedWaterfallState } from "./lib/storage/stateStorage";
import { sortPeriodsByUploadDate } from "./lib/utils/dateUtils";
import { DEFAULT_BOM_COSTS } from "./lib/core/constants";
import { setLocalStorageTimestamp } from "./lib/storage/localStorageUtils";
import Link from "next/link";

export default function Home() {
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Load settings on app start (side effect: caches settings for use across the app)
  useSettings();

  // Use custom hooks for state management
  const {
    salesOrdersList,
    setSalesOrdersList,
    forecastSummaryList,
    setForecastSummaryList,
    bomCosts,
    setBomCosts,
    cellComments,
    setCellComments,
    persistSharedState,
  } = useWaterfallState();

  // Use custom hooks
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

  const { handleSalesOrdersUpload, handleForecastUpload, handleCombinedUpload } = useWaterfallUploads({
    salesOrdersList,
    forecastSummaryList,
    setSalesOrdersList,
    setForecastSummaryList,
    persistSharedState,
  });

  const {
    datePickerOpen,
    editingDate,
    editingAnchor,
    handleDateEdit,
    handleDateSelect,
    closeDatePicker,
    setDatePickerOpen,
  } = useDateEditor({
    salesOrdersList,
    forecastSummaryList,
    bomCosts,
    setSalesOrdersList,
    setForecastSummaryList,
  });

  // Handle click outside for filter menu
  useClickOutside(filterMenuRef, () => setShowFilterMenu(false), showFilterMenu);

  const handleDeleteByDate = useCallback(
    async (idOrDateLabel: number | string) => {
      // Support both ID (new) and dateLabel (backward compatibility)
      const nextSales = typeof idOrDateLabel === "number"
        ? salesOrdersList.filter((so) => so.id !== idOrDateLabel)
        : salesOrdersList.filter((so) => so.uploadDateLabel !== idOrDateLabel);
      
      const nextForecasts = typeof idOrDateLabel === "number"
        ? forecastSummaryList.filter((fc) => fc.id !== idOrDateLabel)
        : forecastSummaryList.filter((fc) => fc.uploadDateLabel !== idOrDateLabel);
      
      // Update state immediately
      setSalesOrdersList(nextSales);
      setForecastSummaryList(nextForecasts);
      const updatedAt = new Date().toISOString();
      
      // Update localStorage immediately to prevent stale data on reload
      try {
        localStorage.setItem("mvst_salesOrdersList", JSON.stringify(nextSales));
        localStorage.setItem("mvst_forecastSummary", JSON.stringify(nextForecasts));
      } catch {
        // ignore
      }
      setLocalStorageTimestamp(updatedAt);
      
      // Save to remote storage with updated timestamp
      await saveSharedWaterfallState({
        salesOrdersList: nextSales,
        forecastSummaryList: nextForecasts,
        bomCosts,
        updatedAt,
      });
    },
    [bomCosts, forecastSummaryList, salesOrdersList, setForecastSummaryList, setSalesOrdersList],
  );


  const handleClearLocalStorage = useCallback(async () => {
    localStorage.removeItem("mvst_salesOrdersList");
    localStorage.removeItem("mvst_forecastSummary");
    localStorage.removeItem("mvst_bom_costs");
    localStorage.removeItem("mvst_state_updatedAt");
    
    // Load data from remote storage
    try {
      const remote = await loadSharedWaterfallState();
      
      if (remote) {
        const sortedSales = sortPeriodsByUploadDate(remote.salesOrdersList || []);
        const sortedForecasts = sortPeriodsByUploadDate(remote.forecastSummaryList || []);
        const remoteBomCosts = remote.bomCosts || DEFAULT_BOM_COSTS;
        
        setSalesOrdersList(sortedSales);
        setForecastSummaryList(sortedForecasts);
        setBomCosts(remoteBomCosts);
        
        // Save to localStorage for future use
        try {
          localStorage.setItem("mvst_salesOrdersList", JSON.stringify(sortedSales));
          localStorage.setItem("mvst_forecastSummary", JSON.stringify(sortedForecasts));
          localStorage.setItem("mvst_bom_costs", JSON.stringify(remoteBomCosts));
          if (remote.updatedAt) {
            setLocalStorageTimestamp(remote.updatedAt);
          }
        } catch {
          // ignore storage errors
        }
        
      } else {
        // No remote data, reset to empty/default values
        setSalesOrdersList([]);
        setForecastSummaryList([]);
        setBomCosts(DEFAULT_BOM_COSTS);
      }
    } catch (error) {
      console.error("Failed to reload data from remote storage:", error);
      // Reset to empty/default values on error
      setSalesOrdersList([]);
      setForecastSummaryList([]);
      setBomCosts(DEFAULT_BOM_COSTS);
    }
  }, [setSalesOrdersList, setForecastSummaryList, setBomCosts]);

  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
      <header className="space-y-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-semibold">MVS-T Demand Waterfall</h1>
        <Link
          href="/forecast-accuracy"
          className="underline text-blue-500 hover:text-blue-700"
        >
          View Forecast Accuracy →
        </Link>
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
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <UploadControls
              onSalesOrdersUpload={handleSalesOrdersUpload}
              onForecastUpload={handleForecastUpload}
              onCombinedUpload={handleCombinedUpload}
              editMode={editMode}
              onToggleEditMode={() => setEditMode((v) => !v)}
            />
            <button
              type="button"
              onClick={handleClearLocalStorage}
              className="inline-flex items-center rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 bg-white hover:bg-neutral-50 transition-colors"
              title="Refresh data from remote storage"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
            <a
              href="/settings"
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 bg-white hover:bg-neutral-50 transition-colors"
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.89 3.31.876 2.42 2.42a1.724 1.724 0 001.065 2.572c1.757.427 1.757 2.925 0 3.352a1.724 1.724 0 00-1.065 2.572c.89 1.543-.877 3.31-2.42 2.42a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.89-3.31-.877-2.42-2.42a1.724 1.724 0 00-1.065-2.572c-1.757-.427-1.757-2.925 0-3.352a1.724 1.724 0 001.065-2.572c-.89-1.544.877-3.31 2.42-2.42.996.574 2.248.25 2.573-1.066z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </a>
          </div>
        </div>
        <div className="overflow-auto rounded-lg border border-neutral-200/60 bg-white">
          <DemandWaterfallTable
            salesOrdersList={filteredSalesOrdersList}
            forecastSummaryList={filteredForecastSummaryList}
            bomCosts={bomCosts}
            cellComments={cellComments}
            onCellCommentChange={async (key, value) => {
              const updatedComments = { ...cellComments };
              if (value && value.trim()) {
                // Set the comment if it has content
                updatedComments[key] = value;
              } else {
                // Delete the comment if it's empty
                delete updatedComments[key];
              }
              setCellComments(updatedComments);
              await persistSharedState(salesOrdersList, forecastSummaryList, bomCosts, updatedComments);
            }}
            editMode={editMode}
            onDateEdit={handleDateEdit}
            onDateDelete={handleDeleteByDate}
          />
        </div>
      </section>
      <DatePickerDialog
        open={datePickerOpen}
        onOpenChange={(open) => {
          setDatePickerOpen(open);
          if (!open) {
            closeDatePicker();
          }
        }}
        date={editingDate}
        onDateSelect={handleDateSelect}
        anchor={editingAnchor ?? undefined}
      />
      <p className="text-[11px] text-neutral-500 text-center mt-6">
        Changes may take a short time to sync across devices; refresh after some times if you don’t see the latest updates.
      </p>
    </main>
  );
}