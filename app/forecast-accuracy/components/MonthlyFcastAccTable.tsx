"use client";

import { useState, useMemo } from "react";
import { SalesOrderSummary } from "../../lib/data/salesOrders";
import { ForecastSummary } from "../../lib/data/forecasts";
import { useForecastAccuracyData } from "../hooks/useForecastAccuracyData";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface MonthlyFcastAccTableProps {
  salesOrdersList: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
  selectedPlatform: string;
}

export default function MonthlyFcastAccTable({ salesOrdersList, forecastSummaryList, selectedPlatform }: MonthlyFcastAccTableProps) {
  const [selectedYear, setSelectedYear] = useState<string | "all">("all");

  const { monthlyAccuracyData } = useForecastAccuracyData(
    salesOrdersList,
    forecastSummaryList,
    selectedPlatform,
    "all",
    "all"
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    monthlyAccuracyData.forEach((item) => {
      const [year] = item.forecastMonthKey.split("-").map(Number);
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [monthlyAccuracyData]);

  const filteredData = useMemo(() => {
    if (selectedYear === "all") return monthlyAccuracyData;
    return monthlyAccuracyData.filter((item) => {
      const [year] = item.forecastMonthKey.split("-").map(Number);
      return year === Number(selectedYear);
    });
  }, [monthlyAccuracyData, selectedYear]);

  if (!selectedPlatform || selectedPlatform === "overall") {
    return (
      <div className="text-neutral-500 italic center">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-sm">Please select a platform above.</p>
          </div>
        </div>
      </div>
    );
  }

  if (monthlyAccuracyData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">Forecast Accuracy by Month</h2>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-neutral-700">Year:</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="text-xs min-w-[120px] h-8">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 text-neutral-700">
                <th className="border-b border-neutral-200 px-3 py-2 text-left">Forecast Month Bucket</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Max Forecast Qty</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Actual Shipped Qty</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Accuracy %</th>
                <th className="border-b border-neutral-200 pl-1 pr-3 py-2 text-right">6-Month Rolling Accuracy %</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-neutral-50 hover:bg-neutral-100/70">
                  <td className="px-3 py-2 border-t border-neutral-200">{row.forecastMonthLabel}</td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right">
                    {row.maxForecastQuantity}
                  </td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right">
                    {row.hasShippedData && row.shippedJobs && row.shippedJobs.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{row.actualShippedQuantity}</span>
                        </TooltipTrigger>
                        <TooltipContent 
                          className="bg-white border border-neutral-200 text-neutral-800 shadow-lg max-w-md"
                          arrowClassName="bg-white border-white fill-white"
                        >
                          <div className="max-h-60 overflow-y-auto pr-1">
                            <div className="flex flex-wrap gap-1">
                              {row.shippedJobs.map((job, i) => (
                                <span key={i} className="inline-block bg-neutral-100 px-2 py-0.5 rounded text-xs">
                                  {job}
                                </span>
                              ))}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      row.hasShippedData ? row.actualShippedQuantity : "N/A"
                    )}
                  </td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right font-semibold">
                    {row.hasShippedData ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{row.forecastAccuracy}%</span>
                        </TooltipTrigger>
                        <TooltipContent 
                          className="bg-white border border-neutral-200 text-neutral-800 shadow-lg"
                          arrowClassName="bg-white border-white fill-white"
                        >
                          <div className="text-xs">
                            {row.actualShippedQuantity} / {row.maxForecastQuantity} = {row.forecastAccuracy}%
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td className="pl-1 pr-3 py-2 border-t border-neutral-200 text-right font-semibold">
                    {row.hasShippedData && row.sixMonthRollingAccuracy !== undefined ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{row.sixMonthRollingAccuracy}%</span>
                        </TooltipTrigger>
                        <TooltipContent 
                          className="bg-white border border-neutral-200 text-neutral-800 shadow-lg"
                          arrowClassName="bg-white border-white fill-white"
                        >
                          <div className="text-xs">
                            {row.actualShippedQuantity} / {row.maxForecastInSixMonths} = {row.sixMonthRollingAccuracy}%
                            <br />
                            <span className="text-neutral-500 text-[10px]">(Current month shipped / Max forecast in 6 months)</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      "N/A"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

