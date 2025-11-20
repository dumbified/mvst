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

const SUMMARY_COLUMNS: { key: string; label: string; width: number }[] = [
  { key: "currTotalSo", label: "Current total SO", width: 110 },
  { key: "currTotalFcst", label: "Current total f'cst", width: 120 },
  { key: "ttlDmd", label: "Ttl Dmd", width: 100 },
  { key: "bomCostRm", label: "BOM Cost (RM)", width: 120 },
  { key: "currTotalSoRm", label: "Current total SO (RM)", width: 150 },
  { key: "currTotalFcstRm", label: "Current total f'cst (RM)", width: 160 },
  { key: "ttlDmdRm", label: "Ttl Dmd (RM)", width: 130 },
];

const BOM_COST_BY_PLATFORM: Record<string, number> = {
  TH3K: 583382,
  TR3K: 834063,
  THSE: 306667,
  "TRS+": 390193,
};

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

    const rows: (string | number)[][] = [];
    const perRowTotals: { so: number; fcst: number; ttl: number; cost: number; soRm: number; fcstRm: number; ttlRm: number }[] = [];

    visiblePlatforms.forEach((platform) => {
      const row: (string | number)[] = [];
      row.push(salesOrders?.uploadDateLabel ?? "");
      row.push(platform);

      let soSum = 0;
      let fcstSum = 0;

      months.forEach((month) => {
        const totals = salesOrders?.totals?.[platform] ?? {};
        const bucket = totals[month.key];
        const soVal = Number(bucket?.quantity ?? 0);
        const fcstVal = 0; // placeholder until forecast data exists
        const ssVal = 0; // placeholder for safety stock
        row.push(soVal || "");
        row.push(fcstVal || "");
        row.push(ssVal || "");
        soSum += soVal;
        fcstSum += fcstVal;
      });

      const cost = BOM_COST_BY_PLATFORM[platform] ?? 0;
      const ttl = soSum + fcstSum;
      const soRm = soSum * cost;
      const fcstRm = fcstSum * cost;
      const ttlRm = ttl * cost;

      row.push(soSum);
      row.push(fcstSum);
      row.push(ttl);
      row.push(cost);
      row.push(soRm);
      row.push(fcstRm);
      row.push(ttlRm);

      rows.push(row);
      perRowTotals.push({ so: soSum, fcst: fcstSum, ttl, cost, soRm, fcstRm, ttlRm });
    });

    // Totals row across platforms
    const totalsRow: (string | number)[] = [];
    totalsRow.push(salesOrders?.uploadDateLabel ?? "");
    totalsRow.push("Total");

    for (let mi = 0; mi < months.length; mi++) {
      const soColIndex = 2 + mi * 3;
      const fcstColIndex = soColIndex + 1;
      const ssColIndex = soColIndex + 2;
      let soSum = 0;
      let fcstSum = 0;
      let ssSum = 0;
      rows.forEach((r) => {
        soSum += Number(r[soColIndex] || 0);
        fcstSum += Number(r[fcstColIndex] || 0);
        ssSum += Number(r[ssColIndex] || 0);
      });
      totalsRow.push(soSum || "");
      totalsRow.push(fcstSum || "");
      totalsRow.push(ssSum || "");
    }

    // Summary columns totals (sum across platforms).
    // Note: Do NOT total BOM Cost (RM); leave it blank on totals row.
    const summaryStart = 2 + months.length * 3;
    for (let i = 0; i < SUMMARY_COLUMNS.length; i++) {
      const colDef = SUMMARY_COLUMNS[i];
      if (colDef.key === "bomCostRm") {
        totalsRow.push("");
        continue;
      }
      let sum = 0;
      rows.forEach((r) => (sum += Number(r[summaryStart + i] || 0)));
      totalsRow.push(sum || "");
    }

    rows.push(totalsRow);
    return rows;
  }, [salesOrders, visiblePlatforms, months]);

  const nestedHeaders = useMemo(() => {
    const topRow: any[] = [
      { label: "Fcast Load in Date", colspan: 1 },
      { label: "Platform", colspan: 1 },
      ...months.map((month) => ({ label: month.label, colspan: 3 })),
      { label: "Summary", colspan: SUMMARY_COLUMNS.length, className: "summary-header" },
    ];
    const secondRow: any[] = [
      "",
      "",
      ...months.flatMap(() => ["SO", "Forecast", "SS"]),
      ...SUMMARY_COLUMNS.map((c) => ({ label: c.label, className: "summary-subheader" })),
    ];
    return [topRow, secondRow];
  }, [months]);

  const colWidths = useMemo(() => {
    const widths: number[] = [150, 110];
    months.forEach(() => widths.push(78, 78, 78));
    SUMMARY_COLUMNS.forEach((c) => widths.push(c.width));
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
    // Merge the date column across all platform rows AND the totals row to avoid duplicate dates
    return [{ row: 0, col: 0, rowspan: visiblePlatforms.length + 1, colspan: 1 }];
  }, [visiblePlatforms]);

  const totalsCellMeta = useMemo(() => {
    if (visiblePlatforms.length === 0) return [];
    const lastRow = visiblePlatforms.length; // totals row index
    const totalCols = 2 + months.length * 3 + SUMMARY_COLUMNS.length;
    const cells: any[] = [];
    for (let c = 0; c < totalCols; c++) {
      cells.push({
        row: lastRow,
        col: c,
        className: "totals-cell",
      });
    }
    // Bold the "Total" label cell
    cells.push({ row: lastRow, col: 1, className: "totals-cell totals-cell-label" });
    return cells;
  }, [visiblePlatforms, months]);

  // Style all cells in the summary area
  const summaryCellMeta = useMemo(() => {
    const meta: any[] = [];
    const summaryStart = 2 + months.length * 3;
    const numRows = visiblePlatforms.length + (visiblePlatforms.length > 0 ? 1 : 0);
    for (let r = 0; r < numRows; r++) {
      for (let i = 0; i < SUMMARY_COLUMNS.length; i++) {
        meta.push({
          row: r,
          col: summaryStart + i,
          className: "summary-cell",
        });
      }
    }
    return meta;
  }, [months, visiblePlatforms]);

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
          cell={[...cellComments, ...summaryCellMeta, ...totalsCellMeta]}
        />
      </div>
    </div>
  );
}
