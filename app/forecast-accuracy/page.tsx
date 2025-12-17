'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { SalesOrderSummary } from "../lib/salesOrders";
import { ForecastSummary } from "../lib/forecasts";
import { loadSharedWaterfallState } from "../lib/stateStorage";
import { PlatformKey } from "../lib/constants";
import { useForecastAccuracyData } from "./hooks/useForecastAccuracyData";
import ForecastAccuracyControls from "./components/ForecastAccuracyControls";
import CombinedChart from "./components/CombinedChart";
import AccuracyChart from "./components/AccuracyChart";
import ForecastAccuracyTable from "./components/ForecastAccuracyTable";
import LoadingState from "./components/LoadingState";
import EmptyState from "./components/EmptyState";
import { ChartType, VisibleSeries } from "./types";

export default function ForecastAccuracyPage() {
  const [salesOrdersList, setSalesOrdersList] = useState<SalesOrderSummary[]>([]);
  const [forecastSummaryList, setForecastSummaryList] = useState<ForecastSummary[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey | "all">("all");
  const [chartType, setChartType] = useState<ChartType>("combined");
  const [visibleSeries, setVisibleSeries] = useState<VisibleSeries>({
    forecastLoadIns: true,
    forecastConversions: true,
    shipped: true,
    movedToLater: true,
    currentTotalSo: true,
  });
  const [startUpload, setStartUpload] = useState<string | "all">("all");
  const [endUpload, setEndUpload] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const state = await loadSharedWaterfallState();
        if (state) {
          setSalesOrdersList(state.salesOrdersList || []);
          setForecastSummaryList(state.forecastSummaryList || []);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const { uploadChanges, allUploadDates, chartData } = useForecastAccuracyData(
    salesOrdersList,
    forecastSummaryList,
    selectedPlatform,
    startUpload,
    endUpload,
  );

  if (loading) {
    return <LoadingState />;
  }

  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
      <header className="space-y-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-semibold">Forecast Accuracy</h1>
        <Link href="/" className="underline text-blue-500">
          ← Back to Waterfall
        </Link>
      </header>

      <section className="space-y-6">
        {uploadChanges.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ForecastAccuracyControls
              selectedPlatform={selectedPlatform}
              onPlatformChange={setSelectedPlatform}
              chartType={chartType}
              onChartTypeChange={setChartType}
              visibleSeries={visibleSeries}
              onVisibleSeriesChange={setVisibleSeries}
              startUpload={startUpload}
              onStartUploadChange={setStartUpload}
              endUpload={endUpload}
              onEndUploadChange={setEndUpload}
              allUploadDates={allUploadDates}
            />

            {chartType === "combined" && (
              <CombinedChart data={chartData} visibleSeries={visibleSeries} />
            )}

            {chartType === "accuracy" && (
              <AccuracyChart data={chartData} />
            )}

            <ForecastAccuracyTable data={chartData} />
          </>
        )}
      </section>
    </main>
  );
}

