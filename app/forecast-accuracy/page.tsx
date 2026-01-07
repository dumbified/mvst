'use client';

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { SalesOrderSummary } from "../lib/data/salesOrders";
import { ForecastSummary } from "../lib/data/forecasts";
import { loadSharedWaterfallState } from "../lib/storage/stateStorage";
import { getBomCosts } from "../lib/core/constants";
import { getAllPlatforms } from "../lib/core/platformUtils";
import { useForecastAccuracyData } from "./hooks/useForecastAccuracyData";
import ForecastAccuracyControls from "./components/ForecastAccuracyControls";
import ForecastAccuracyTabs from "./components/ForecastAccuracyTabs";
import LoadingState from "./components/LoadingState";
import EmptyState from "./components/EmptyState";
import { ChartType, VisibleSeries } from "./types";
import { parseDateLabel } from "../lib/utils/dateUtils";
import { formatMonthLabel, monthKeyFromDate } from "../lib/data/salesOrders";
import { monthKeyToTimestamp } from "../lib/utils/dateUtils";

export default function ForecastAccuracyPage() {
  const [salesOrdersList, setSalesOrdersList] = useState<SalesOrderSummary[]>([]);
  const [forecastSummaryList, setForecastSummaryList] = useState<ForecastSummary[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("th3k");
  const [chartType, setChartType] = useState<ChartType>("accuracy");
  const [visibleSeries, setVisibleSeries] = useState<VisibleSeries>({
    forecastLoadIns: true,
    forecastConversions: true,
    shipped: true,
    movedToLater: true,
    currentTotalSo: true,
  });
  const [startMonth, setStartMonth] = useState<string | "all">("all");
  const [endMonth, setEndMonth] = useState<string | "all">("all");
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

  // Dynamically discover all platforms from data and settings
  const allPlatforms = useMemo(
    () => getAllPlatforms(salesOrdersList, forecastSummaryList, getBomCosts()),
    [salesOrdersList, forecastSummaryList]
  );

  // Ensure selectedPlatform is valid - default to "th3k" if available, otherwise first platform.
  // Allow special "overall" platform which aggregates all platforms.
  useEffect(() => {
    if (
      allPlatforms.length > 0 &&
      selectedPlatform !== "overall" &&
      (!selectedPlatform || !allPlatforms.includes(selectedPlatform))
    ) {
      const defaultPlatform = allPlatforms.includes("th3k") ? "th3k" : allPlatforms[0];
      setSelectedPlatform(defaultPlatform);
    }
  }, [allPlatforms, selectedPlatform]);

  // Collect available months from uploads
  const allMonths = useMemo(() => {
    const monthSet = new Set<string>();
    const collect = (list: { uploadDateLabel: string }[]) => {
      list.forEach((item) => {
        const parsed = parseDateLabel(item.uploadDateLabel);
        if (!parsed) return;
        const key = monthKeyFromDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
        monthSet.add(key);
      });
    };
    collect(salesOrdersList);
    collect(forecastSummaryList);
    return Array.from(monthSet)
      .sort()
      .map((key) => ({
        key,
        label: formatMonthLabel(key),
        time: monthKeyToTimestamp(key),
      }));
  }, [salesOrdersList, forecastSummaryList]);

  const { uploadChanges, chartData, monthlyAccuracyData, monthlySummaryData } = useForecastAccuracyData(
    salesOrdersList,
    forecastSummaryList,
    selectedPlatform,
    startMonth,
    endMonth,
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
              allPlatforms={allPlatforms}
              chartType={chartType}
              onChartTypeChange={setChartType}
              visibleSeries={visibleSeries}
              onVisibleSeriesChange={setVisibleSeries}
              startMonth={startMonth}
              onStartMonthChange={setStartMonth}
              endMonth={endMonth}
              onEndMonthChange={setEndMonth}
              allMonths={allMonths}
            />

            <ForecastAccuracyTabs
              chartType={chartType}
              chartData={chartData}
              monthlyAccuracyData={monthlyAccuracyData}
              monthlySummaryData={monthlySummaryData}
              visibleSeries={visibleSeries}
              salesOrdersList={salesOrdersList}
              forecastSummaryList={forecastSummaryList}
              selectedPlatform={selectedPlatform}
            />
          </>
        )}
      </section>
    </main>
  );
}

