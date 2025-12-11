"use client";

import { useState, useRef } from "react";
import { PLATFORM_LABELS, PlatformKey } from "../../lib/constants";
import { ChartType, VisibleSeries, UploadDateOption } from "../types";
import { useClickOutside } from "../../hooks/useClickOutside";

interface ForecastAccuracyControlsProps {
  selectedPlatform: PlatformKey | "all";
  onPlatformChange: (platform: PlatformKey | "all") => void;
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
  const seriesMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(seriesMenuRef, () => setShowSeriesMenu(false), showSeriesMenu);

  return (
    <div className="flex flex-wrap gap-3 items-start">
      <div className="flex flex-col gap-1">
        <label className="block text-xs font-medium text-neutral-700">Platform</label>
        <select
          value={selectedPlatform}
          onChange={(e) => onPlatformChange(e.target.value as PlatformKey | "all")}
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs bg-white min-w-[140px]"
        >
          <option value="all">All Platforms</option>
          {PLATFORM_LABELS.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="block text-xs font-medium text-neutral-700">Chart Type</label>
        <select
          value={chartType}
          onChange={(e) => onChartTypeChange(e.target.value as ChartType)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs bg-white min-w-[150px]"
        >
          <option value="combined">Combined View</option>
          <option value="accuracy">Accuracy Only</option>
        </select>
      </div>

      {/* Separator */}
      <div className="h-full w-px bg-neutral-200 mx-1 self-stretch" />

      <div className="flex flex-col gap-1">
        <label className="block text-xs font-medium text-neutral-700">Upload Range</label>
        <div className="flex items-center gap-2">
          <select
            value={startUpload}
            onChange={(e) => onStartUploadChange(e.target.value as string)}
            className="rounded border border-neutral-300 px-2 py-1 text-xs bg-white min-w-[140px]"
          >
            <option value="all">Start: All</option>
            {allUploadDates.map((d) => (
              <option key={`start-${d.label}`} value={d.label}>
                {d.label}
              </option>
            ))}
          </select>
          <span className="text-neutral-500 text-xs">to</span>
          <select
            value={endUpload}
            onChange={(e) => onEndUploadChange(e.target.value as string)}
            className="rounded border border-neutral-300 px-2 py-1 text-xs bg-white min-w-[140px]"
          >
            <option value="all">End: All</option>
            {allUploadDates.map((d) => (
              <option key={`end-${d.label}`} value={d.label}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Separator */}
      <div className="h-full w-px bg-neutral-200 mx-1 self-stretch" />

      <div className="relative" ref={seriesMenuRef}>
        <label className="block text-xs font-medium text-neutral-700 mb-1">Series</label>
        <button
          type="button"
          onClick={() => setShowSeriesMenu((prev) => !prev)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs bg-white hover:bg-neutral-50 min-w-[140px] text-left"
        >
          Toggle Series ▾
        </button>
        {showSeriesMenu && (
          <div className="absolute z-[7000] mt-1 w-48 rounded-lg border border-neutral-200 bg-white shadow-lg p-3 text-xs">
            <div className="flex flex-col gap-2">
              {[
                { key: "forecastLoadIns", label: "New Forecast" },
                { key: "newOrders", label: "New Orders" },
                { key: "shipped", label: "Shipped" },
                { key: "movedToLater", label: "Delayed" },
              ].map(({ key, label }) => (
                <label key={key} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={visibleSeries[key as keyof VisibleSeries]}
                    onChange={(e) =>
                      onVisibleSeriesChange({ ...visibleSeries, [key]: e.target.checked })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

