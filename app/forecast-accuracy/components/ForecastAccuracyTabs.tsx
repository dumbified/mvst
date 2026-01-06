"use client";

import { useState } from "react";
import { ChartType, ChartDataPoint, MonthlyAccuracyData, MonthlySummaryData, VisibleSeries } from "../types";
import { SalesOrderSummary } from "../../lib/data/salesOrders";
import { ForecastSummary } from "../../lib/data/forecasts";
import CombinedChart from "./CombinedChart";
import AccuracyChart from "./AccuracyChart";
import ChangeSummaryTable from "./ChangeSummaryTable";
import MonthlySummaryTable from "./MonthlySummaryTable";
import MonthlyFcastAccTable from "./MonthlyFcastAccTable";

interface ForecastAccuracyTabsProps {
  chartType: ChartType;
  chartData: ChartDataPoint[];
  monthlyAccuracyData: MonthlyAccuracyData[];
  monthlySummaryData: MonthlySummaryData[];
  visibleSeries: VisibleSeries;
  salesOrdersList: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
  selectedPlatform: string;
}

type TabType = "summary" | "accuracy";

export default function ForecastAccuracyTabs({
  chartType,
  chartData,
  monthlyAccuracyData,
  monthlySummaryData,
  visibleSeries,
  salesOrdersList,
  forecastSummaryList,
  selectedPlatform,
}: ForecastAccuracyTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("summary");

  const tabs: { id: TabType; label: string }[] = [
    { id: "summary", label: "Summary Tables" },
    { id: "accuracy", label: "Forecast Accuracy" },
  ];

  return (
    <div className="space-y-6">
      {/* Charts - Always Visible */}
      <div>
        {chartType === "combined" && (
          <CombinedChart data={chartData} visibleSeries={visibleSeries} />
        )}

        {chartType === "accuracy" && (
          <AccuracyChart data={monthlyAccuracyData} />
        )}
      </div>

      {/* Tables with Tabs */}
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="border-b border-neutral-200">
          <nav className="flex gap-1" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-2 text-sm font-medium border-b-2 transition-colors
                  ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-300"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "summary" && (
            <>
              <ChangeSummaryTable data={chartData} />
              <MonthlySummaryTable data={monthlySummaryData} />
            </>
          )}

          {activeTab === "accuracy" && (
            <MonthlyFcastAccTable 
              salesOrdersList={salesOrdersList} 
              forecastSummaryList={forecastSummaryList}
              selectedPlatform={selectedPlatform}
            />
          )}
        </div>
      </div>
    </div>
  );
}

