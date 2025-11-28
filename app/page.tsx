'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import DemandWaterfallTable from "./components/DemandWaterfallTable";
import UploadControls from "./components/UploadControls";
import DatePickerDialog from "./components/DatePickerDialog";
import { SalesOrderSummary, parseSalesOrdersCsv } from "./lib/salesOrders";
import { ForecastSummary, parseForecastCsv } from "./lib/forecasts";
import { uploadFileToSupabase } from "./lib/storage";
import { parseDateLabel, sortPeriodsByUploadDate } from "./lib/dateUtils";
import { updatePeriodDates } from "./lib/periodUtils";
import { useMonthFilter } from "./hooks/useMonthFilter";
import { useWaterfallState } from "./hooks/useWaterfallState";
import { useClickOutside } from "./hooks/useClickOutside";

export default function Home() {
  const {
    salesOrdersList,
    forecastSummaryList,
    bomCosts,
    setSalesOrdersList,
    setForecastSummaryList,
    setBomCosts,
    persistSharedState,
  } = useWaterfallState();

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [editingDateLabel, setEditingDateLabel] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<Date | undefined>(undefined);
  const [editingAnchor, setEditingAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const bucketName = "uploads";

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

  const handleBomCostsChange = useCallback(
    async (newBomCosts: Record<string, number>) => {
      setBomCosts(newBomCosts);
      await persistSharedState(salesOrdersList, forecastSummaryList, newBomCosts);
    },
    [salesOrdersList, forecastSummaryList, persistSharedState],
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
          await persistSharedState(nextSales, forecastSummaryList, bomCosts);
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
          await persistSharedState(salesOrdersList, nextForecasts, bomCosts);
        }
      } catch (error) {
        console.error("Failed to process Forecast CSV", error);
      }
    },
    [bucketName, forecastSummaryList, persistSharedState, salesOrdersList],
  );

  const handleDeleteByDate = useCallback(
    async (dateLabel: string) => {
      const nextSales = salesOrdersList.filter((so) => so.uploadDateLabel !== dateLabel);
      const nextForecasts = forecastSummaryList.filter((fc) => fc.uploadDateLabel !== dateLabel);
      setSalesOrdersList(nextSales);
      setForecastSummaryList(nextForecasts);
      await persistSharedState(nextSales, nextForecasts, bomCosts);
    },
    [bomCosts, forecastSummaryList, persistSharedState, salesOrdersList],
  );

  useClickOutside(filterMenuRef, () => setShowFilterMenu(false), showFilterMenu);

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
    async (newDate: Date) => {
      if (!editingDateLabel) return;

      const { salesOrders, forecasts } = updatePeriodDates(
        salesOrdersList,
        forecastSummaryList,
        editingDateLabel,
        newDate,
      );

      const nextSales = sortPeriodsByUploadDate(salesOrders);
      const nextForecasts = sortPeriodsByUploadDate(forecasts);

      setForecastSummaryList(nextForecasts);
      setSalesOrdersList(nextSales);

      // Ensure shared state is persisted with updated dates
      await persistSharedState(nextSales, nextForecasts, bomCosts);

      setDatePickerOpen(false);
      setEditingDateLabel(null);
      setEditingDate(undefined);
      setEditingAnchor(null);
    },
    [bomCosts, editingDateLabel, forecastSummaryList, persistSharedState, salesOrdersList],
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
