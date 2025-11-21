"use client";

import { useCallback, useState } from "react";
import DemandWaterfallTable from "./components/DemandWaterfallTable";
import UploadControls from "./components/UploadControls";
import { SalesOrderSummary, parseSalesOrdersCsv } from "./lib/salesOrders";
import { ForecastSummary, parseForecastCsv } from "./lib/forecasts";

export default function Home() {
  const [salesOrdersList, setSalesOrdersList] = useState<SalesOrderSummary[]>([]);
  const [forecastSummary, setForecastSummary] = useState<ForecastSummary | null>(null);

  const handleSalesOrdersUpload = useCallback(async (file: File) => {
    try {
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
      const csvText = await file.text();
      const summary = parseForecastCsv(csvText, new Date());
      setForecastSummary(summary);
    } catch (error) {
      console.error("Failed to process Forecast CSV", error);
      setForecastSummary(null);
    }
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
          />
        </div>
        <div className="overflow-auto rounded-lg border border-neutral-200/60 bg-white">
          <DemandWaterfallTable
            salesOrdersList={salesOrdersList}
            forecastSummary={forecastSummary}
          />
        </div>
      </section>
    </main>
  );
}
