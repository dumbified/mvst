"use client";

import { useState, useMemo } from "react";
import { MonthlyAccuracyData } from "../types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MonthlySummaryTableProps {
  data: MonthlyAccuracyData[];
}

export default function MonthlySummaryTable({ data }: MonthlySummaryTableProps) {
  const [selectedYear, setSelectedYear] = useState<string | "all">("all");

  // Extract available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    data.forEach((item) => {
      const [year] = item.uploadMonthKey.split("-").map(Number);
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a); // Most recent first
  }, [data]);

  // Filter data by year
  const filteredData = useMemo(() => {
    if (selectedYear === "all") return data;
    return data.filter((item) => {
      const [year] = item.uploadMonthKey.split("-").map(Number);
      return year === Number(selectedYear);
    });
  }, [data, selectedYear]);

  if (data.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">Summary by Upload Month</h2>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-neutral-700">Filter by Year:</Label>
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
                <th className="border-b border-neutral-200 px-3 py-2 text-left">Upload Month</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Total Shipped</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Total Forecasted</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Total Fcast → SO</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-neutral-50 hover:bg-neutral-100/70">
                  <td className="px-3 py-2 border-t border-neutral-200">{row.uploadMonthLabel}</td>
                  <td
                    className="px-3 py-2 border-t border-neutral-200 text-right"
                    title={row.shippedJobs.length > 0 ? row.shippedJobs.join(", ") : undefined}
                  >
                    {row.totalShipped}
                  </td>
                  <td
                    className="px-3 py-2 border-t border-neutral-200 text-right"
                    title={row.forecastLoadInsJobs.length > 0 ? row.forecastLoadInsJobs.join(", ") : undefined}
                  >
                    {row.uniqueForecastJobs}
                  </td>
                  <td
                    className="px-3 py-2 border-t border-neutral-200 text-right"
                    title={row.forecastConversionsJobs.length > 0 ? `Converted Jobs: ${row.forecastConversionsJobs.join(", ")}` : undefined}
                  >
                    {row.totalFcastToSo}
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

