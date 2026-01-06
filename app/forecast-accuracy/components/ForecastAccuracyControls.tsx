"use client";

import { useState } from "react";
import { ChartType, VisibleSeries, MonthOption } from "../types";
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
  startMonth: string | "all";
  onStartMonthChange: (month: string | "all") => void;
  endMonth: string | "all";
  onEndMonthChange: (month: string | "all") => void;
  allMonths: MonthOption[];
}

export default function ForecastAccuracyControls({
  selectedPlatform,
  onPlatformChange,
  allPlatforms,
  chartType,
  onChartTypeChange,
  visibleSeries,
  onVisibleSeriesChange,
  startMonth,
  onStartMonthChange,
  endMonth,
  onEndMonthChange,
  allMonths,
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
        <Label className="text-xs font-medium text-neutral-700">Month Range</Label>
        <div className="flex items-center gap-2">
          <Select value={startMonth} onValueChange={onStartMonthChange}>
            <SelectTrigger className="text-xs min-w-[140px] h-8">
              <SelectValue placeholder="Start month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Start: All</SelectItem>
              {allMonths.map((m) => (
                <SelectItem key={`start-${m.key}`} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-neutral-500 text-xs">to</span>
          <Select value={endMonth} onValueChange={onEndMonthChange}>
            <SelectTrigger className="text-xs min-w-[140px] h-8">
              <SelectValue placeholder="End month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">End: All</SelectItem>
              {allMonths.map((m) => (
                <SelectItem key={`end-${m.key}`} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

