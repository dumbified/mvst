"use client";

import { useCallback, useEffect, useState } from "react";
import DemandWaterfallTable from "./components/DemandWaterfallTable";
import UploadControls from "./components/UploadControls";
import { SalesOrderSummary, parseSalesOrdersCsv } from "./lib/salesOrders";
import { ForecastSummary, parseForecastCsv } from "./lib/forecasts";
import { uploadFileToSupabase } from "./lib/storage";

export default function Home() {
  const [salesOrdersList, setSalesOrdersList] = useState<SalesOrderSummary[]>([]);
  const [forecastSummary, setForecastSummary] = useState<ForecastSummary | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
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
        if (parsed && typeof parsed === "object") {
          setForecastSummary(parsed);
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
      localStorage.setItem("mvst_forecastSummary", JSON.stringify(forecastSummary));
    } catch {
      // ignore
    }
  }, [forecastSummary]);

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
      setForecastSummary(summary);
    } catch (error) {
      console.error("Failed to process Forecast CSV", error);
      setForecastSummary(null);
    }
  }, []);

  const handleDeleteByDate = useCallback((dateLabel: string) => {
    setSalesOrdersList((prev) => prev.filter((so) => so.uploadDateLabel !== dateLabel));
    setForecastSummary((prev) => (prev?.uploadDateLabel === dateLabel ? null : prev));
  }, []);

  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
      <header className="space-y-2">
        <h1 className="text-xl md:text-2xl font-semibold">MVST Demand Waterfall</h1>
      </header>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="text-xs text-neutral-500">SO = Sales Orders · SS = Safety Stock</div>
          <UploadControls
            onSalesOrdersUpload={handleSalesOrdersUpload}
            onForecastUpload={handleForecastUpload}
            deleteMode={deleteMode}
            onToggleDeleteMode={() => setDeleteMode((v) => !v)}
          />
        </div>
        <div className="overflow-auto rounded-lg border border-neutral-200/60 bg-white">
          <DemandWaterfallTable
            salesOrdersList={salesOrdersList}
            forecastSummary={forecastSummary}
            deleteMode={deleteMode}
            onDeleteByDate={handleDeleteByDate}
          />
        </div>
      </section>
    </main>
  );
}
