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
  const [startYear, setStartYear] = useState<string>("all");
  const [startMonth, setStartMonth] = useState<string>("all");
  const [endYear, setEndYear] = useState<string>("all");
  const [endMonth, setEndMonth] = useState<string>("all");
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

  // Collect available months from uploads and group by year
  const { allMonths, monthsByYear, availableYears } = useMemo(() => {
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
    
    const months = Array.from(monthSet)
      .sort()
      .map((key) => ({
        key,
        label: formatMonthLabel(key),
        time: monthKeyToTimestamp(key),
      }));

    // Group months by year
    const grouped: Record<number, typeof months> = {};
    months.forEach((month) => {
      const [year] = month.key.split("-").map(Number);
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(month);
    });

    // Get available years
    const years = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);

    return {
      allMonths: months,
      monthsByYear: grouped,
      availableYears: years,
    };
  }, [salesOrdersList, forecastSummaryList]);

  // Handle year changes - clear month if year changes
  const handleStartYearChange = (year: string) => {
    setStartYear(year);
    if (year !== "all" && startMonth !== "all") {
      // Check if the selected month exists in the new year
      const monthsInYear = monthsByYear[Number(year)] || [];
      const monthExists = monthsInYear.some((m) => {
        const [, monthNum] = m.key.split("-").map(Number);
        return monthNum === Number(startMonth);
      });
      if (!monthExists) {
        setStartMonth("all");
      }
    } else if (year === "all") {
      setStartMonth("all");
    }
  };

  const handleEndYearChange = (year: string) => {
    setEndYear(year);
    if (year !== "all" && endMonth !== "all") {
      // Check if the selected month exists in the new year
      const monthsInYear = monthsByYear[Number(year)] || [];
      const monthExists = monthsInYear.some((m) => {
        const [, monthNum] = m.key.split("-").map(Number);
        return monthNum === Number(endMonth);
      });
      if (!monthExists) {
        setEndMonth("all");
      }
    } else if (year === "all") {
      setEndMonth("all");
    }
  };

  // Build month keys from year and month selections
  const startMonthKey = useMemo(() => {
    if (startYear === "all" || startMonth === "all") return "all";
    return `${startYear}-${String(Number(startMonth)).padStart(2, "0")}`;
  }, [startYear, startMonth]);

  const endMonthKey = useMemo(() => {
    if (endYear === "all" || endMonth === "all") return "all";
    return `${endYear}-${String(Number(endMonth)).padStart(2, "0")}`;
  }, [endYear, endMonth]);

  const { uploadChanges, chartData, monthlyAccuracyData, monthlySummaryData } = useForecastAccuracyData(
    salesOrdersList,
    forecastSummaryList,
    selectedPlatform,
    startMonthKey,
    endMonthKey,
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
              startYear={startYear}
              startMonth={startMonth}
              onStartYearChange={handleStartYearChange}
              onStartMonthChange={setStartMonth}
              endYear={endYear}
              endMonth={endMonth}
              onEndYearChange={handleEndYearChange}
              onEndMonthChange={setEndMonth}
              allMonths={allMonths}
              monthsByYear={monthsByYear}
              availableYears={availableYears}
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

