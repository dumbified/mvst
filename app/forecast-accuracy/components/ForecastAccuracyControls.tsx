"use client";

import { useState } from "react";
import { ChartType, VisibleSeries, UploadDateOption } from "../types";
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
  selectedPlatform: string | "all";
  onPlatformChange: (platform: string | "all") => void;
  allPlatforms: string[];
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  visibleSeries: VisibleSeries;
  onVisibleSeriesChange: (series: VisibleSeries) => void;
  startUpload: string | "all";
  onStartUploadChange: (upload: string | "all") => void;
  endUpload: string | "all";
  onEndUploadChange: (upload: string | "all") => void;
  allUploadDates: UploadDateOption[];
}

export default function ForecastAccuracyControls({
  selectedPlatform,
  onPlatformChange,
  allPlatforms,
  chartType,
  onChartTypeChange,
  visibleSeries,
  onVisibleSeriesChange,
  startUpload,
  onStartUploadChange,
  endUpload,
  onEndUploadChange,
  allUploadDates,
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
            <SelectItem value="all">All Platforms</SelectItem>
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
            <SelectItem value="combined">Combined View</SelectItem>
            <SelectItem value="accuracy">Accuracy Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Separator */}
      <div className="h-full w-px bg-neutral-200 mx-1 self-stretch" />

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-neutral-700">Upload Range</Label>
        <div className="flex items-center gap-2">
          <Select value={startUpload} onValueChange={onStartUploadChange}>
            <SelectTrigger className="text-xs min-w-[140px] h-8">
              <SelectValue placeholder="Start date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Start: All</SelectItem>
              {allUploadDates.map((d) => (
                <SelectItem key={`start-${d.label}`} value={d.label}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-neutral-500 text-xs">to</span>
          <Select value={endUpload} onValueChange={onEndUploadChange}>
            <SelectTrigger className="text-xs min-w-[140px] h-8">
              <SelectValue placeholder="End date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">End: All</SelectItem>
              {allUploadDates.map((d) => (
                <SelectItem key={`end-${d.label}`} value={d.label}>
                  {d.label}
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
              className="text-xs min-w-[140px] h-8 justify-start"
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

