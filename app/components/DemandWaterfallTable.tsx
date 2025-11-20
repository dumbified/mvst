'use client';

import React, { useMemo, useState, useRef, useEffect } from "react";
import { HotTable } from "@handsontable/react-wrapper";
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { registerAllModules } from 'handsontable/registry';
import { PLATFORM_LABELS, PlatformKey, SalesOrderSummary } from "../lib/salesOrders";

registerAllModules();

type MonthColumn = { key: string; label: string };

const DEFAULT_MONTHS: MonthColumn[] = [
  { key: "2025-03", label: "Mar 25" },
  { key: "2025-04", label: "Apr 25" },
  { key: "2025-05", label: "May 25" },
  { key: "2025-06", label: "Jun 25" },
  { key: "2025-07", label: "Jul 25" },
  { key: "2025-08", label: "Aug 25" },
  { key: "2025-09", label: "Sep 25" },
  { key: "2025-10", label: "Oct 25" },
  { key: "2025-11", label: "Nov 25" },
  { key: "2025-12", label: "Dec 25" },
  { key: "2026-01", label: "Jan 26" },
  { key: "2026-02", label: "Feb 26" },
];

const PLATFORM_OPTIONS: PlatformKey[] = [...PLATFORM_LABELS];

type DemandWaterfallTableProps = {
  salesOrders?: SalesOrderSummary | null;
};

export default function DemandWaterfallTable({ salesOrders }: DemandWaterfallTableProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() => [...PLATFORM_OPTIONS]);
  const hotTableRef = useRef<any>(null);

  const months = useMemo<MonthColumn[]>(() => salesOrders?.months ?? DEFAULT_MONTHS, [salesOrders]);

  const visiblePlatforms = useMemo(
    () => PLATFORM_OPTIONS.filter((platform) => selectedPlatforms.includes(platform)),
    [selectedPlatforms]
  );

  const data = useMemo(() => {
    if (visiblePlatforms.length === 0) {
      return [];
    }

    return visiblePlatforms.map((platform) => {
      const row: (string | number)[] = [];
      row.push(salesOrders?.uploadDateLabel ?? "");
      row.push(platform);
      months.forEach((month) => {
        const totals = salesOrders?.totals?.[platform] ?? {};
        const bucket = totals[month.key];
        row.push(bucket?.quantity ?? "");
        row.push("");
        row.push("");
      });
      return row;
    });
  }, [salesOrders, visiblePlatforms, months]);

  const nestedHeaders = useMemo(() => {
    const topRow: any[] = [
      { label: "Fcast Load in Date", colspan: 1 },
      { label: "Platform", colspan: 1 },
      ...months.map((month) => ({ label: month.label, colspan: 3 })),
    ];
    const secondRow: any[] = [
      "",
      "",
      ...months.flatMap(() => ["SO", "Forecast", "SS"]),
    ];
    return [topRow, secondRow];
  }, [months]);

  const colWidths = useMemo(() => {
    const widths: number[] = [140, 120];
    months.forEach(() => widths.push(72, 72, 72));
    return widths;
  }, [months]);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const mergeBodyCells = useMemo(() => {
    if (visiblePlatforms.length <= 1) {
      return [];
    }
    return [{ row: 0, col: 0, rowspan: visiblePlatforms.length, colspan: 1 }];
  }, [visiblePlatforms]);

  const cellComments = useMemo(() => {
    if (!salesOrders) return [];
    const comments: { row: number; col: number; comment: { value: string } }[] = [];

    visiblePlatforms.forEach((platform, rowIndex) => {
      const totals = salesOrders.totals[platform] ?? {};
      months.forEach((month, monthIndex) => {
        const bucket = totals[month.key];
        if (!bucket || bucket.jobNumbers.length === 0) return;
        const colIndex = 2 + monthIndex * 3;
        comments.push({
          row: rowIndex,
          col: colIndex,
          comment: {
            value: bucket.jobNumbers.join("\n"),
          },
        });
      });
    });

    return comments;
  }, [salesOrders, visiblePlatforms, months]);

  useEffect(() => {
    if (hotTableRef.current?.hotInstance) {
      const hot = hotTableRef.current.hotInstance;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < hot.countCols(); col++) {
          const cell = hot.getCell(row, col);
          if (cell) cell.style.fontWeight = "bold";
        }
      }
    }
  }, [data, months, selectedPlatforms]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-sm font-medium text-neutral-700">Filter by Platform:</span>
        <div className="flex items-center gap-3 flex-wrap">
          {PLATFORM_OPTIONS.map((platform) => (
            <label key={platform} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={() => togglePlatform(platform)}
                className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-neutral-700">{platform}</span>
            </label>
          ))}
        </div>
        {selectedPlatforms.length === 0 && (
          <span className="text-xs text-amber-600 ml-auto">No platforms selected</span>
        )}
      </div>

      <div className="bg-white" style={{ height: 600, width: "100%" }}>
        <HotTable
          ref={hotTableRef}
          data={data}
          colHeaders={true}
          nestedHeaders={nestedHeaders as any}
          rowHeaders={false}
          colWidths={colWidths}
          fixedColumnsStart={2}
          rowHeights={24}
          height={600}
          stretchH="all"
          className="hot-waterfall ht-theme-main"
          licenseKey="non-commercial-and-evaluation"
          mergeCells={mergeBodyCells}
          comments={true}
          cell={cellComments}
        />
      </div>
    </div>
  );
}
