"use client";

import { useCallback, useState } from "react";
import DemandWaterfallTable from "./components/DemandWaterfallTable";
import UploadControls from "./components/UploadControls";
import { SalesOrderSummary, parseSalesOrdersCsv } from "./lib/salesOrders";

export default function Home() {
  const [salesOrders, setSalesOrders] = useState<SalesOrderSummary | null>(null);

  const handleSalesOrdersUpload = useCallback(async (file: File) => {
    try {
      const csvText = await file.text();
      const summary = parseSalesOrdersCsv(csvText, new Date());
      setSalesOrders(summary);
    } catch (error) {
      console.error("Failed to process Sales Orders CSV", error);
      setSalesOrders(null);
    }
  }, []);

  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold">MVST Demand Waterfall</h1>
      </header>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="text-xs text-neutral-500">SO = Sales Orders · SS = Safety Stock</div>
          <UploadControls onSalesOrdersUpload={handleSalesOrdersUpload} />
        </div>
        <div className="overflow-auto rounded-lg border border-neutral-200/60 bg-white">
          <DemandWaterfallTable salesOrders={salesOrders} />
        </div>
      </section>
    </main>
  );
}
