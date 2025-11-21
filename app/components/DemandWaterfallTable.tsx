'use client';

import React, { useMemo, useState, useRef, useEffect } from "react";
import { HotTable } from "@handsontable/react-wrapper";
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { registerAllModules } from 'handsontable/registry';
import {
  PLATFORM_LABELS,
  PlatformKey,
  SalesOrderSummary,
  SalesOrderBucket,
  formatMonthLabel,
} from "../lib/salesOrders";
import { ForecastSummary } from "../lib/forecasts";
import { textRenderer } from "handsontable/renderers/textRenderer";

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
  { key: "currTotalSo", label: "Current total SO", width: 90 },
  { key: "currTotalFcst", label: "Current total f'cst", width: 100 },
  { key: "ttlDmd", label: "Ttl Dmd", width: 80 },
  { key: "bomCostRm", label: "BOM Cost (RM)", width: 100 },
  { key: "currTotalSoRm", label: "Current total SO (RM)", width: 125 },
  { key: "currTotalFcstRm", label: "Current total f'cst (RM)", width: 135 },
  { key: "ttlDmdRm", label: "Ttl Dmd (RM)", width: 110 },
];

const DEFAULT_BOM_COSTS: Record<string, number> = {
  TH3K: 583382,
  TR3K: 834063,
  THSE: 306667,
  "TRS+": 390193,
};

type DemandWaterfallTableProps = {
  salesOrdersList?: SalesOrderSummary[];
  forecastSummary?: ForecastSummary | null;
};

export default function DemandWaterfallTable({
  salesOrdersList = [],
  forecastSummary,
}: DemandWaterfallTableProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() => [...PLATFORM_OPTIONS]);
  const [showTotals, setShowTotals] = useState<boolean>(true);
  const hotTableRef = useRef<any>(null);
  const bomEditorButtonRef = useRef<HTMLButtonElement>(null);
  const bomEditorPopupRef = useRef<HTMLDivElement>(null);
  const [bomCosts, setBomCosts] = useState<Record<string, number>>(DEFAULT_BOM_COSTS);
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [editingCosts, setEditingCosts] = useState<Record<string, string>>(() => {
    const obj: Record<string, string> = {};
    PLATFORM_OPTIONS.forEach((p) => (obj[p] = String(DEFAULT_BOM_COSTS[p] ?? 0)));
    return obj;
  });

  // Merge all months from uploads and forecast
  const months = useMemo<MonthColumn[]>(() => {
    const monthSet = new Set<string>();
    const labelMap = new Map<string, string>();

    const addMonths = (entries?: { key: string; label: string }[]) => {
      entries?.forEach(({ key, label }) => {
        monthSet.add(key);
        if (!labelMap.has(key)) {
          labelMap.set(key, label);
        }
      });
    };

    salesOrdersList.forEach((so) => addMonths(so.months));
    addMonths(forecastSummary?.months ?? []);

    if (monthSet.size === 0) return DEFAULT_MONTHS;

    return Array.from(monthSet)
      .sort()
      .map((key) => ({
        key,
        label: labelMap.get(key) ?? formatMonthLabel(key),
      }));
  }, [salesOrdersList, forecastSummary]);

  const visiblePlatforms = useMemo(
    () => PLATFORM_OPTIONS.filter((platform) => selectedPlatforms.includes(platform)),
    [selectedPlatforms]
  );

  // Load saved BOM costs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mvst_bom_costs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setBomCosts((prev) => ({ ...prev, ...parsed }));
          const asStrings: Record<string, string> = {};
          PLATFORM_OPTIONS.forEach((p) => (asStrings[p] = String(parsed[p] ?? DEFAULT_BOM_COSTS[p] ?? 0)));
          setEditingCosts(asStrings);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveBomCosts = () => {
    const next: Record<string, number> = {};
    PLATFORM_OPTIONS.forEach((p) => {
      const v = Number(String(editingCosts[p] ?? "").replace(/,/g, ""));
      next[p] = Number.isFinite(v) ? v : 0;
    });
    setBomCosts(next);
    try {
      localStorage.setItem("mvst_bom_costs", JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
    setIsEditingCosts(false);
  };

  // Handle click outside to close popup and position popup correctly
  useEffect(() => {
    if (!isEditingCosts) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        bomEditorPopupRef.current &&
        bomEditorButtonRef.current &&
        !bomEditorPopupRef.current.contains(event.target as Node) &&
        !bomEditorButtonRef.current.contains(event.target as Node)
      ) {
        setIsEditingCosts(false);
      }
    };

    // Position popup relative to button
    if (bomEditorButtonRef.current && bomEditorPopupRef.current) {
      const buttonRect = bomEditorButtonRef.current.getBoundingClientRect();
      const popup = bomEditorPopupRef.current;
      popup.style.position = "fixed";
      popup.style.top = `${buttonRect.bottom + window.scrollY + 4}px`;
      popup.style.right = `${window.innerWidth - buttonRect.right}px`;
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditingCosts]);

  const data = useMemo(() => {
    if (visiblePlatforms.length === 0) {
      return [];
    }

    const rows: (string | number)[][] = [];
    const forecastTotals: Record<PlatformKey, Record<string, number>> =
      forecastSummary?.totals ?? ({} as Record<PlatformKey, Record<string, number>>);

    const effectivePeriods =
      salesOrdersList.length > 0
        ? salesOrdersList
        : forecastSummary
        ? [
            {
              uploadDateLabel: forecastSummary.uploadDateLabel,
              months: forecastSummary.months,
              totals: PLATFORM_LABELS.reduce(
                (acc, platform) => ({
                  ...acc,
                  [platform]: {},
                }),
                {} as Record<PlatformKey, Record<string, SalesOrderBucket>>,
              ),
            },
          ]
        : [];

    // Create rows for each period (upload date) and platform combination
    effectivePeriods.forEach((salesOrders) => {
      const periodRows: (string | number)[][] = [];

      visiblePlatforms.forEach((platform) => {
        const row: (string | number)[] = [];
        row.push(salesOrders.uploadDateLabel);
        row.push(platform);

        let soSum = 0;
        let fcstSum = 0;

        const orderTotals = salesOrders.totals[platform] ?? {};
        const platformForecast = forecastTotals[platform] ?? {};

        months.forEach((month) => {
          const bucket = orderTotals[month.key];
          const soVal = Number(bucket?.quantity ?? 0);
          const fcstVal = Number(platformForecast[month.key] ?? 0);
          const ssVal = 0; // placeholder for safety stock
          row.push(soVal || "");
          row.push(fcstVal || "");
          row.push(ssVal || "");
          soSum += soVal;
          fcstSum += fcstVal;
        });

        const cost = bomCosts[platform] ?? 0;
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

        periodRows.push(row);
        rows.push(row);
      });

      // Add totals row for this period (only if showTotals is true)
      if (showTotals) {
        const totalsRow: (string | number)[] = [];
        totalsRow.push(""); // Empty date so it merges with the date above
        totalsRow.push("Total");

        for (let mi = 0; mi < months.length; mi++) {
          const soColIndex = 2 + mi * 3;
          const fcstColIndex = soColIndex + 1;
          const ssColIndex = soColIndex + 2;
          let soSum = 0;
          let fcstSum = 0;
          let ssSum = 0;
          periodRows.forEach((r) => {
            soSum += Number(r[soColIndex] || 0);
            fcstSum += Number(r[fcstColIndex] || 0);
            ssSum += Number(r[ssColIndex] || 0);
          });
          totalsRow.push(soSum || "");
          totalsRow.push(fcstSum || "");
          totalsRow.push(ssSum || "");
        }

        // Summary columns totals for this period
        const summaryStart = 2 + months.length * 3;
        for (let i = 0; i < SUMMARY_COLUMNS.length; i++) {
          const colDef = SUMMARY_COLUMNS[i];
          if (colDef.key === "bomCostRm") {
            totalsRow.push("");
            continue;
          }
          let sum = 0;
          periodRows.forEach((r) => (sum += Number(r[summaryStart + i] || 0)));
          totalsRow.push(sum || "");
        }

        rows.push(totalsRow);
      }
    });

    return rows;
  }, [salesOrdersList, visiblePlatforms, months, bomCosts, showTotals, forecastSummary]);

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
    const widths: number[] = [120, 90];
    months.forEach(() => widths.push(60, 60, 60));
    SUMMARY_COLUMNS.forEach((c) => widths.push(c.width));
    return widths;
  }, [months]);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const mergeBodyCells = useMemo(() => {
    const rowsPerPeriod = showTotals ? visiblePlatforms.length + 1 : visiblePlatforms.length;
    const periodCount =
      salesOrdersList.length > 0 ? salesOrdersList.length : forecastSummary ? 1 : 0;
    if (visiblePlatforms.length <= 1 || periodCount === 0 || rowsPerPeriod <= 1) {
      return [];
    }

    const merges: any[] = [];
    for (let periodIndex = 0; periodIndex < periodCount; periodIndex++) {
      const startRow = periodIndex * rowsPerPeriod;
      merges.push({
        row: startRow,
        col: 0,
        rowspan: rowsPerPeriod,
        colspan: 1,
      });
    }
    return merges;
  }, [visiblePlatforms, salesOrdersList, forecastSummary, showTotals]);

  const totalsCellMeta = useMemo(() => {
    const periodCount =
      salesOrdersList.length > 0 ? salesOrdersList.length : forecastSummary ? 1 : 0;
    if (visiblePlatforms.length === 0 || periodCount === 0 || !showTotals) return [];
    const totalCols = 2 + months.length * 3 + SUMMARY_COLUMNS.length;
    const cells: any[] = [];
    
    // Add totals row styling for each period (excluding date column 0)
    for (let periodIndex = 0; periodIndex < periodCount; periodIndex++) {
      const rowsPerPeriod = visiblePlatforms.length + 1;
      const totalsRowIndex = periodIndex * rowsPerPeriod + visiblePlatforms.length;
      // Start from column 1 (skip date column 0)
      for (let c = 1; c < totalCols; c++) {
        cells.push({
          row: totalsRowIndex,
          col: c,
          className: "totals-cell",
        });
      }
      cells.push({ row: totalsRowIndex, col: 1, className: "totals-cell totals-cell-label" });
    }
    
    return cells;
  }, [visiblePlatforms, months, salesOrdersList, forecastSummary, showTotals]);

  // Style all cells in the summary area
  const summaryCellMeta = useMemo(() => {
    const meta: any[] = [];
    const summaryStart = 2 + months.length * 3;
    const rowsPerPeriod = showTotals ? visiblePlatforms.length + 1 : visiblePlatforms.length;
    if (rowsPerPeriod === 0) return meta;
    const periodCount =
      salesOrdersList.length > 0 ? salesOrdersList.length : forecastSummary ? 1 : 0;
    const numRows = periodCount * rowsPerPeriod;
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
  }, [months, visiblePlatforms, salesOrdersList, forecastSummary, showTotals]);

  const cellComments = useMemo(() => {
    if (salesOrdersList.length === 0) return [];
    const comments: { row: number; col: number; comment: { value: string } }[] = [];

    salesOrdersList.forEach((salesOrders, periodIndex) => {
      visiblePlatforms.forEach((platform, platformIndex) => {
        // Calculate row index accounting for totals rows (if shown)
        const rowsPerPeriod = showTotals ? visiblePlatforms.length + 1 : visiblePlatforms.length;
        const rowIndex = periodIndex * rowsPerPeriod + platformIndex;
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
    });

    return comments;
  }, [salesOrdersList, visiblePlatforms, months, showTotals]);

  // Numeric renderer with thousand separators
  const numberRenderer = useMemo(() => {
    return function (
      instance: any,
      td: HTMLTableCellElement,
      row: number,
      col: number,
      prop: any,
      value: any,
      cellProperties: any
    ) {
      const n = value === "" || value === null || value === undefined ? "" : Number(value);
      const text = typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : (value ?? "");
      textRenderer(instance, td, row, col, prop, text as any, cellProperties);
    };
  }, []);

  useEffect(() => {
    if (hotTableRef.current?.hotInstance) {
      const hot = hotTableRef.current.hotInstance;
      
      // Set header font size and weight directly via DOM
      const container = hot.rootElement;
      if (container) {
        // Target all header cells in the main table and clones
        const headerCells = container.querySelectorAll('thead th, .ht_clone_top thead th, .ht_clone_left_top thead th');
        headerCells.forEach((cell: any) => {
          if (cell) {
            cell.style.fontSize = '11px';
            cell.style.fontWeight = 'bold';
            // Also target any nested elements
            const nested = cell.querySelectorAll('*');
            nested.forEach((el: any) => {
              el.style.fontSize = '11px';
            });
          }
        });
      }
      
      // Ensure all data cells are not bold and have correct font size
      const totalRows = hot.countRows();
      for (let row = 0; row < totalRows; row++) {
        for (let col = 0; col < hot.countCols(); col++) {
          const cell = hot.getCell(row, col);
          if (cell) {
            cell.style.fontWeight = "normal";
            cell.style.fontSize = "11px";
          }
        }
      }
    }
  }, [data, months, selectedPlatforms]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-xs font-medium text-neutral-600">Filter by Platforms:</span>
        <div className="flex items-center gap-2">
          {PLATFORM_OPTIONS.map((platform) => (
            <label key={platform} className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-neutral-100">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={() => togglePlatform(platform)}
                className="w-3.5 h-3.5 text-blue-600 border-neutral-300 rounded focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-neutral-700">{platform}</span>
            </label>
          ))}
        </div>
        <div className="h-4 w-px bg-neutral-300 mx-1" />
        <label className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-neutral-100">
          <input
            type="checkbox"
            checked={showTotals}
            onChange={(e) => setShowTotals(e.target.checked)}
            className="w-3.5 h-3.5 text-blue-600 border-neutral-300 rounded focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-neutral-700">Totals</span>
        </label>
        <div className="ml-auto relative" style={{ zIndex: 1000 }}>
          <button
            ref={bomEditorButtonRef}
            className="inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
            onClick={() => {
              setEditingCosts((prev) => {
                const next: Record<string, string> = { ...prev };
                PLATFORM_OPTIONS.forEach((p) => (next[p] = String(bomCosts[p] ?? 0)));
                return next;
              });
              setIsEditingCosts((v) => !v);
            }}
          >
            Edit BOM Costs
          </button>

          {isEditingCosts && (
            <div
              ref={bomEditorPopupRef}
              className="p-2 rounded-md border border-neutral-300 bg-white shadow-lg"
              style={{ 
                minWidth: "280px",
                zIndex: 1001
              }}
            >
              <div className="space-y-2">
                {PLATFORM_OPTIONS.map((p) => (
                  <div key={`cost-${p}`} className="flex items-center gap-2">
                    <span className="w-12 text-xs text-neutral-700">{p}</span>
                    <input
                      type="number"
                      step="1"
                      className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
                      value={editingCosts[p] ?? ""}
                      onChange={(e) =>
                        setEditingCosts((prev) => ({ ...prev, [p]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-neutral-200 flex items-center gap-2">
                <button
                  className="flex-1 rounded-md bg-blue-600 text-white px-2 py-1 text-xs hover:bg-blue-700"
                  onClick={saveBomCosts}
                >
                  Save
                </button>
                <button
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 bg-white hover:bg-neutral-50"
                  onClick={() => setIsEditingCosts(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
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
          cells={(row, col) => {
            const props: any = {};
            const classNames: string[] = [];
            
            // Format all data columns except the first two (date, platform)
            if (col >= 2) {
              props.renderer = numberRenderer as any;
            }
            
            // Apply summary cell styling
            const summaryStart = 2 + months.length * 3;
            if (col >= summaryStart && col < summaryStart + SUMMARY_COLUMNS.length) {
              classNames.push("summary-cell");
            }
            
            // Apply totals row styling - check if this row is a totals row for any period
            // Exclude date column (col 0) from totals styling
            if (showTotals && visiblePlatforms.length > 0 && salesOrdersList.length > 0 && col > 0) {
              salesOrdersList.forEach((_, periodIndex) => {
                const rowsPerPeriod = visiblePlatforms.length + 1;
                const totalsRowIndex = periodIndex * rowsPerPeriod + visiblePlatforms.length;
                if (row === totalsRowIndex) {
                  classNames.push("totals-cell");
                  if (col === 1) {
                    classNames.push("totals-cell-label");
                  }
                }
              });
            }
            
            if (classNames.length > 0) {
              props.className = classNames.join(" ");
            }
            
            return props;
          }}
        />
      </div>
    </div>
  );
}
