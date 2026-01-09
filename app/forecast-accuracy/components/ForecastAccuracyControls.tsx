"use client";

import { useState } from "react";
import { ChartType, VisibleSeries, MonthOption } from "../types";
import { MONTH_ABBREVIATIONS } from "../../lib/core/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ForecastAccuracyControlsProps {
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  allPlatforms: string[];
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  visibleSeries: VisibleSeries;
  onVisibleSeriesChange: (series: VisibleSeries) => void;
  startYear: string;
  startMonth: string;
  onStartYearChange: (year: string) => void;
  onStartMonthChange: (month: string) => void;
  endYear: string;
  endMonth: string;
  onEndYearChange: (year: string) => void;
  onEndMonthChange: (month: string) => void;
  allMonths: MonthOption[];
  monthsByYear: Record<number, MonthOption[]>;
  availableYears: number[];
}

export default function ForecastAccuracyControls({
  selectedPlatform,
  onPlatformChange,
  allPlatforms,
  chartType,
  onChartTypeChange,
  visibleSeries,
  onVisibleSeriesChange,
  startYear,
  startMonth,
  onStartYearChange,
  onStartMonthChange,
  endYear,
  endMonth,
  onEndYearChange,
  onEndMonthChange,
  allMonths,
  monthsByYear,
  availableYears,
}: ForecastAccuracyControlsProps) {
  const [showSeriesMenu, setShowSeriesMenu] = useState(false);

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-neutral-700">Platform</Label>
        <Select value={selectedPlatform} onValueChange={onPlatformChange}>
          <SelectTrigger className="text-xs min-w-[140px] h-8">
            <SelectValue placeholder="Select platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overall">
              All Platforms
            </SelectItem>
            {allPlatforms.map((platform) => (
              <SelectItem key={platform} value={platform}>
                {platform}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-neutral-700">Chart Type</Label>
        <Select value={chartType} onValueChange={(value) => onChartTypeChange(value as ChartType)}>
          <SelectTrigger className="text-xs min-w-[150px] h-8">
            <SelectValue placeholder="Select chart type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="accuracy">Accuracy</SelectItem>
            <SelectItem value="combined">Combined View</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Separator */}
      <div className="h-full w-px bg-neutral-200 mx-1 self-stretch" />

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-neutral-700">Filter Period</Label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Select value={startYear} onValueChange={onStartYearChange}>
              <SelectTrigger className="text-xs min-w-[80px] h-8">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={`start-year-${year}`} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={startMonth} onValueChange={onStartMonthChange} disabled={!startYear || startYear === "all"}>
              <SelectTrigger className="text-xs min-w-[90px] h-8" disabled={!startYear || startYear === "all"}>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {startYear && monthsByYear[Number(startYear)]?.map((m) => {
                  const [, monthNum] = m.key.split("-").map(Number);
                  return (
                    <SelectItem key={`start-${m.key}`} value={String(monthNum)}>
                      {MONTH_ABBREVIATIONS[monthNum - 1]}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <span className="text-neutral-500 text-xs">to</span>
          <div className="flex items-center gap-1">
            <Select value={endYear} onValueChange={onEndYearChange}>
              <SelectTrigger className="text-xs min-w-[80px] h-8">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={`end-year-${year}`} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={endMonth} onValueChange={onEndMonthChange} disabled={!endYear || endYear === "all"}>
              <SelectTrigger className="text-xs min-w-[90px] h-8" disabled={!endYear || endYear === "all"}>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {endYear && monthsByYear[Number(endYear)]?.map((m) => {
                  const [, monthNum] = m.key.split("-").map(Number);
                  return (
                    <SelectItem key={`end-${m.key}`} value={String(monthNum)}>
                      {MONTH_ABBREVIATIONS[monthNum - 1]}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="h-full w-px bg-neutral-200 mx-1 self-stretch" />

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-neutral-700">Series</Label>
        <Popover open={showSeriesMenu} onOpenChange={setShowSeriesMenu}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="text-xs min-w-[140px] h-9 justify-start"
            >
              Toggle Series ▾
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3" align="start">
            <div className="flex flex-col gap-2">
              {[
                { key: "forecastLoadIns", label: "New Forecast" },
                { key: "forecastConversions", label: "Fcast → SO" },
                { key: "shipped", label: "Shipped" },
                { key: "movedToLater", label: "Delayed" },
                { key: "currentTotalSo", label: "Total SO" },
              ].map(({ key, label }) => (
                <Label
                  key={key}
                  htmlFor={`series-${key}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    id={`series-${key}`}
                    checked={visibleSeries[key as keyof VisibleSeries]}
                    onCheckedChange={(checked) =>
                      onVisibleSeriesChange({ ...visibleSeries, [key]: checked === true })
                    }
                  />
                  <span className="text-xs">{label}</span>
                </Label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

