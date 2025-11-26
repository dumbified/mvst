"use client";

import { useCallback, useEffect, useState } from "react";
import DemandWaterfallTable from "./components/DemandWaterfallTable";
import UploadControls from "./components/UploadControls";
import DatePickerDialog from "./components/DatePickerDialog";
import { SalesOrderSummary, parseSalesOrdersCsv, formatFullDate, formatMonthLabel, monthKeyFromDate } from "./lib/salesOrders";
import { ForecastSummary, parseForecastCsv } from "./lib/forecasts";
import { uploadFileToSupabase } from "./lib/storage";

const MONTH_LOOKUP: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export default function Home() {
  const [salesOrdersList, setSalesOrdersList] = useState<SalesOrderSummary[]>([]);
  const [forecastSummaryList, setForecastSummaryList] = useState<ForecastSummary[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [editingDateLabel, setEditingDateLabel] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<Date | undefined>(undefined);
  const [editingAnchor, setEditingAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const bucketName = "uploads";

  // Load saved data on mount
  useEffect(() => {
    try {
      const soJson = localStorage.getItem("mvst_salesOrdersList");
      const fcJson = localStorage.getItem("mvst_forecastSummary");
      if (soJson) {
        const parsed = JSON.parse(soJson);
        if (Array.isArray(parsed)) {
          setSalesOrdersList(parsed);
        }
      }
      if (fcJson) {
        const parsed = JSON.parse(fcJson);
        // Support both old format (single object) and new format (array)
        if (Array.isArray(parsed)) {
          setForecastSummaryList(parsed);
        } else if (parsed && typeof parsed === "object" && parsed.uploadDateLabel) {
          // Migrate old single forecast to array format
          setForecastSummaryList([parsed]);
        }
      }
    } catch {
      // ignore storage errors
    }
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

  const handleSalesOrdersUpload = useCallback(async (file: File) => {
    try {
      // Persist original file in Supabase Storage
      await uploadFileToSupabase(bucketName, file, "sales-orders");
      const csvText = await file.text();
      const summary = parseSalesOrdersCsv(csvText, new Date());
      if (summary) {
        setSalesOrdersList((prev) => [...prev, summary]);
      }
    } catch (error) {
      console.error("Failed to process Sales Orders CSV", error);
    }
  }, []);

  const handleForecastUpload = useCallback(async (file: File) => {
    try {
      // Persist original file in Supabase Storage
      await uploadFileToSupabase(bucketName, file, "forecasts");
      const csvText = await file.text();
      const summary = parseForecastCsv(csvText, new Date());
      if (summary) {
        setForecastSummaryList((prev) => [...prev, summary]);
      }
    } catch (error) {
      console.error("Failed to process Forecast CSV", error);
    }
  }, []);

  const handleDeleteByDate = useCallback((dateLabel: string) => {
    setSalesOrdersList((prev) => prev.filter((so) => so.uploadDateLabel !== dateLabel));
    setForecastSummaryList((prev) => prev.filter((fc) => fc.uploadDateLabel !== dateLabel));
  }, []);

  const buildMonthsForUploadDate = useCallback((date: Date) => {
    const startKey = monthKeyFromDate(new Date(date.getFullYear(), date.getMonth(), 1));
    const months: { key: string; label: string }[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(date.getFullYear(), date.getMonth(), 1);
      d.setMonth(d.getMonth() + i);
      const key = monthKeyFromDate(d);
      months.push({ key, label: formatMonthLabel(key) });
    }
    return months;
  }, []);

  // Parse date from dateLabel string (format: "DD MMM YYYY")
  const parseDateFromLabel = useCallback(
    (dateLabel: string): Date | null => {
      const match = dateLabel.trim().match(/^(\d{2})\s+([A-Za-z]{3})\s+(\d{4})$/);
      if (!match) return null;
      const [, dayStr, monthStrRaw, yearStr] = match;
      const monthStr = monthStrRaw.slice(0, 3);
      const monthIndex = MONTH_LOOKUP[monthStr as keyof typeof MONTH_LOOKUP];
      if (monthIndex == null) return null;
      const day = Number(dayStr);
      const year = Number(yearStr);
      const parsed = new Date(year, monthIndex, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    },
    []
  );

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
      const currentDate = parseDateFromLabel(dateLabel);
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
    [datePickerOpen, editingDateLabel, parseDateFromLabel]
  );

  const handleDateDelete = useCallback((dateLabel: string) => {
    handleDeleteByDate(dateLabel);
  }, [handleDeleteByDate]);

  const handleDateSelect = useCallback((newDate: Date) => {
    if (!editingDateLabel) return;

    const months = buildMonthsForUploadDate(newDate);
    const newDateLabel = formatFullDate(newDate);

    // Update forecast if it matches
    setForecastSummaryList((prev) =>
      prev.map((fc) =>
        fc.uploadDateLabel === editingDateLabel
          ? {
              ...fc,
              uploadDateLabel: newDateLabel,
              months,
            }
          : fc
      )
    );

    // Update sales orders if any match
    setSalesOrdersList((prev) =>
      prev.map((so) =>
        so.uploadDateLabel === editingDateLabel
          ? {
              ...so,
              uploadDateLabel: newDateLabel,
              months,
            }
          : so
      )
    );

    // Close the dialog
    setDatePickerOpen(false);
    setEditingDateLabel(null);
    setEditingDate(undefined);
    setEditingAnchor(null);
  }, [editingDateLabel, buildMonthsForUploadDate]);

  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
      <header className="space-y-2">
        <h1 className="text-xl md:text-2xl font-semibold">MVS-T Demand Waterfall</h1>
      </header>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="text-xs text-neutral-500">SO = Sales Orders · SS = Safety Stock</div>
          <UploadControls
            onSalesOrdersUpload={handleSalesOrdersUpload}
            onForecastUpload={handleForecastUpload}
            editMode={editMode}
            onToggleEditMode={() => setEditMode((v) => !v)}
          />
        </div>
        <div className="overflow-auto rounded-lg border border-neutral-200/60 bg-white">
          <DemandWaterfallTable
            salesOrdersList={salesOrdersList}
            forecastSummaryList={forecastSummaryList}
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
