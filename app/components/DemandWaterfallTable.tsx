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

const SUMMARY_COLUMNS: { key: string; label: string }[] = [
  { key: "currTotalSo", label: "Current total SO" },
  { key: "currTotalFcst", label: "Current total f'cst" },
  { key: "ttlDmd", label: "Ttl Dmd" },
  { key: "bomCostRm", label: "BOM Cost (RM)" },
  { key: "currTotalSoRm", label: "Current total SO (RM)" },
  { key: "currTotalFcstRm", label: "Current total f'cst (RM)" },
  { key: "ttlDmdRm", label: "Ttl Dmd (RM)" },
];

const SUMMARY_COLUMN_WIDTHS: Record<string, number> = {
  currTotalSo: 90,
  currTotalFcst: 100,
  ttlDmd: 80,
  bomCostRm: 100,
  currTotalSoRm: 125,
  currTotalFcstRm: 135,
  ttlDmdRm: 110,
};

const TABLE_FONT_SIZE_PX = 10;

const DEFAULT_BOM_COSTS: Record<string, number> = {
  TH3K: 583382,
  TR3K: 834063,
  THSE: 306667,
  "TRS+": 390193,
};

type DateAnchor = { top: number; left: number; width: number; height: number };

type DemandWaterfallTableProps = {
  salesOrdersList?: SalesOrderSummary[];
  forecastSummaryList?: ForecastSummary[];
  editMode?: boolean;
  onDateEdit?: (dateLabel: string, anchor?: DateAnchor) => void;
  onDateDelete?: (dateLabel: string) => void;
};

export default function DemandWaterfallTable({
  salesOrdersList = [],
  forecastSummaryList = [],
  editMode = false,
  onDateEdit,
  onDateDelete,
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

  // Merge all months from uploads and forecasts
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
    forecastSummaryList.forEach((fc) => addMonths(fc.months));

    if (monthSet.size === 0) return DEFAULT_MONTHS;

    return Array.from(monthSet)
      .sort()
      .map((key) => ({
        key,
        label: labelMap.get(key) ?? formatMonthLabel(key),
      }));
  }, [salesOrdersList, forecastSummaryList]);

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

    // Create a map of forecasts by uploadDateLabel for quick lookup
    const forecastMap = new Map<string, ForecastSummary>();
    forecastSummaryList.forEach((fc) => {
      forecastMap.set(fc.uploadDateLabel, fc);
    });

    const effectivePeriods =
      salesOrdersList.length > 0
        ? salesOrdersList
        : forecastSummaryList.length > 0
        ? forecastSummaryList.map((fc) => ({
            uploadDateLabel: fc.uploadDateLabel,
            months: fc.months,
            totals: PLATFORM_LABELS.reduce(
              (acc, platform) => ({
                ...acc,
                [platform]: {},
              }),
              {} as Record<PlatformKey, Record<string, SalesOrderBucket>>,
            ),
          }))
        : [];

    // Create rows for each period (upload date) and platform combination
    effectivePeriods.forEach((salesOrders) => {
      const periodRows: (string | number)[][] = [];

      // Find the forecast for this specific period
      const periodForecast = forecastMap.get(salesOrders.uploadDateLabel);

      visiblePlatforms.forEach((platform) => {
        const row: (string | number)[] = [];
        row.push(salesOrders.uploadDateLabel);
        row.push(platform);

        let soSum = 0;
        let fcstSum = 0;

        const orderTotals = salesOrders.totals[platform] ?? {};
        const platformForecast = periodForecast?.totals[platform] ?? {};
        
        // Get the valid months for this period (months >= upload month)
        const periodMonthKeys = new Set(salesOrders.months.map(m => m.key));
        const forecastMonthKeys = periodForecast ? new Set(periodForecast.months.map(m => m.key)) : new Set<string>();

        months.forEach((month) => {
          // Only show data if this month is >= the period's upload month
          const isPeriodMonth = periodMonthKeys.has(month.key);
          // Forecast should only show if month >= forecast upload month AND month >= period upload month
          const isForecastMonth = forecastMonthKeys.has(month.key) && isPeriodMonth;
          
          const bucket = isPeriodMonth ? orderTotals[month.key] : undefined;
          const soVal = isPeriodMonth ? Number(bucket?.quantity ?? 0) : 0;
          const fcstVal = isForecastMonth ? Number(platformForecast[month.key] ?? 0) : 0;
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
  }, [salesOrdersList, visiblePlatforms, months, bomCosts, showTotals, forecastSummaryList]);

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
    SUMMARY_COLUMNS.forEach((c) => widths.push(SUMMARY_COLUMN_WIDTHS[c.key] ?? 90));
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
      salesOrdersList.length > 0 ? salesOrdersList.length : forecastSummaryList.length;
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
  }, [visiblePlatforms, salesOrdersList, forecastSummaryList, showTotals]);

  const totalsCellMeta = useMemo(() => {
    const periodCount =
      salesOrdersList.length > 0 ? salesOrdersList.length : forecastSummaryList.length;
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
  }, [visiblePlatforms, months, salesOrdersList, forecastSummaryList, showTotals]);

  // Style all cells in the summary area
  const summaryCellMeta = useMemo(() => {
    const meta: any[] = [];
    const summaryStart = 2 + months.length * 3;
    const rowsPerPeriod = showTotals ? visiblePlatforms.length + 1 : visiblePlatforms.length;
    if (rowsPerPeriod === 0) return meta;
    const periodCount =
      salesOrdersList.length > 0 ? salesOrdersList.length : forecastSummaryList.length;
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
  }, [months, visiblePlatforms, salesOrdersList, forecastSummaryList, showTotals]);

  // Helper to get row metadata (period, platform index, isTotals, valid months)
  const getRowMetadata = useMemo(() => {
    const effectivePeriods =
      salesOrdersList.length > 0
        ? salesOrdersList
        : forecastSummaryList.length > 0
        ? forecastSummaryList.map((fc) => ({
            uploadDateLabel: fc.uploadDateLabel,
            months: fc.months,
            totals: PLATFORM_LABELS.reduce(
              (acc, platform) => ({
                ...acc,
                [platform]: {},
              }),
              {} as Record<PlatformKey, Record<string, SalesOrderBucket>>,
            ),
          }))
        : [];
    
    const rowsPerPeriod = showTotals ? visiblePlatforms.length + 1 : visiblePlatforms.length;
    
    return (row: number) => {
      const periodIndex = Math.floor(row / rowsPerPeriod);
      const rowInPeriod = row % rowsPerPeriod;
      const isTotals = showTotals && rowInPeriod === visiblePlatforms.length;
      const platformIndex = isTotals ? -1 : rowInPeriod;
      
      if (periodIndex >= effectivePeriods.length) {
        return { periodIndex: -1, platformIndex: -1, isTotals: false, validMonthKeys: new Set<string>() };
      }
      
      const period = effectivePeriods[periodIndex];
      const validMonthKeys = new Set(period.months.map(m => m.key));
      
      return { periodIndex, platformIndex, isTotals, validMonthKeys };
    };
  }, [salesOrdersList, visiblePlatforms, showTotals, forecastSummaryList]);

  const cellComments = useMemo(() => {
    if (salesOrdersList.length === 0) return [];
    const comments: { row: number; col: number; comment: { value: string } }[] = [];

    salesOrdersList.forEach((salesOrders, periodIndex) => {
      // Get the valid months for this period (months >= upload month)
      const periodMonthKeys = new Set(salesOrders.months.map(m => m.key));
      
      visiblePlatforms.forEach((platform, platformIndex) => {
        // Calculate row index accounting for totals rows (if shown)
        const rowsPerPeriod = showTotals ? visiblePlatforms.length + 1 : visiblePlatforms.length;
        const rowIndex = periodIndex * rowsPerPeriod + platformIndex;
        const totals = salesOrders.totals[platform] ?? {};
        months.forEach((month, monthIndex) => {
          // Only add comments for months that are valid for this period
          if (!periodMonthKeys.has(month.key)) return;
          
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

  // Function to reapply borders to all cells
  const reapplyBorders = useMemo(() => {
    return () => {
      if (hotTableRef.current?.hotInstance) {
        const hot = hotTableRef.current.hotInstance;
        const container = hot.rootElement;
        if (!container) return;
        
        // Reapply border classes to header cells
        const allHeaderCells = container.querySelectorAll('thead th, .ht_clone_top thead th, .ht_clone_left_top thead th');
        allHeaderCells.forEach((cell: any) => {
          if (!cell.classList.contains('summary-header') && !cell.classList.contains('summary-subheader')) {
            cell.classList.add("dark-border-header");
            // Force border style to ensure it persists
            cell.style.border = "0.1px solid #000000";
          } else {
            cell.classList.remove("dark-border-header");
          }
        });
        
        // Reapply border classes to data cells
        const totalRows = hot.countRows();
        const summaryStart = 2 + months.length * 3;
        
        for (let row = 0; row < totalRows; row++) {
          const metadata = getRowMetadata(row);
          const { validMonthKeys } = metadata;
          
          for (let col = 0; col < hot.countCols(); col++) {
            try {
              const cell = hot.getCell(row, col);
              if (cell) {
                // Determine if this column should have dark borders
                const isMonthColumn = col >= 2 && col < summaryStart;
                let isInValidMonth = false;
                if (isMonthColumn) {
                  const monthIndex = Math.floor((col - 2) / 3);
                  if (monthIndex >= 0 && monthIndex < months.length) {
                    const monthKey = months[monthIndex].key;
                    isInValidMonth = validMonthKeys.has(monthKey);
                  }
                }
                
                // Apply dark border only for: date column (0), platform column (1), and valid month columns
                const shouldHaveDarkBorder = col === 0 || col === 1 || (isMonthColumn && isInValidMonth);
                
                if (shouldHaveDarkBorder) {
                  cell.classList.add("dark-border-cell");
                  // Force border style to ensure it persists even in edit mode
                  cell.style.border = "0.1px solid #000000";
                } else {
                  cell.classList.remove("dark-border-cell");
                  if (isMonthColumn) {
                    // Clear border for invalid months
                    cell.style.border = "";
                  }
                }
              }
            } catch (e) {
              // Ignore errors for cells that don't exist
            }
          }
        }
      }
    };
  }, [months, getRowMetadata]);

  useEffect(() => {
    if (hotTableRef.current?.hotInstance) {
      const hot = hotTableRef.current.hotInstance;
      
      // Set header font size and weight directly via DOM
      const container = hot.rootElement;
      if (container) {
        // Target all header cells in the main table and clones
        const headerCells = container.querySelectorAll('thead th, .ht_clone_top thead th, .ht_clone_left_top thead th');
        const headerFontSize = `${TABLE_FONT_SIZE_PX}px`;
        headerCells.forEach((cell: any) => {
          if (cell) {
            cell.style.fontSize = headerFontSize;
            cell.style.fontWeight = 'bold';
            // Also target any nested elements
            const nested = cell.querySelectorAll('*');
            nested.forEach((el: any) => {
              el.style.fontSize = headerFontSize;
            });
          }
        });
      }
      
      // Apply borders initially
      reapplyBorders();
      
      // Reapply borders after cell changes
      const handleAfterChange = () => {
        setTimeout(() => reapplyBorders(), 0);
      };
      
      // Reapply borders after selection changes (when exiting edit mode)
      const handleAfterSelectionEnd = () => {
        setTimeout(() => reapplyBorders(), 0);
      };
      
      // Reapply borders when edit mode changes
      const handleAfterBeginEditing = () => {
        setTimeout(() => reapplyBorders(), 0);
      };
      
      hot.addHook('afterChange', handleAfterChange);
      hot.addHook('afterSelectionEnd', handleAfterSelectionEnd);
      hot.addHook('afterBeginEditing', handleAfterBeginEditing);
      
      return () => {
        hot.removeHook('afterChange', handleAfterChange);
        hot.removeHook('afterSelectionEnd', handleAfterSelectionEnd);
        hot.removeHook('afterBeginEditing', handleAfterBeginEditing);
      };
    }
  }, [data, months, selectedPlatforms, getRowMetadata, editMode, reapplyBorders]);

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
            Edit BOM Costs (RM)
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

      <style>{`
        .hot-waterfall .htCore,
        .hot-waterfall .htCore td,
        .hot-waterfall .htCore th,
        .hot-waterfall .ht_clone_top thead th,
        .hot-waterfall .ht_clone_left_top thead th {
          font-size: ${TABLE_FONT_SIZE_PX}px !important;
          line-height: 1.2;
        }
        .hot-waterfall .handsontableInput,
        .hot-waterfall input,
        .hot-waterfall textarea {
          font-size: ${TABLE_FONT_SIZE_PX}px !important;
        }
        
        /* Ensure table uses border-collapse to prevent double borders */
        .hot-waterfall table,
        .hot-waterfall .ht_clone_top table,
        .hot-waterfall .ht_clone_left table,
        .hot-waterfall .ht_clone_left_top table {
          border-collapse: collapse !important;
          border-spacing: 0 !important;
        }
        
        /* Dark borders for valid months, date, and platform columns */
        /* Apply all borders - border-collapse will merge adjacent borders */
        .hot-waterfall .dark-border-cell,
        .hot-waterfall .dark-border-cell td,
        .hot-waterfall .dark-border-cell th,
        .hot-waterfall .dark-border-cell.current,
        .hot-waterfall .dark-border-cell.area,
        .hot-waterfall .dark-border-cell.htInvalid {
          border: 0.1px solid #000000 !important;
        }
        .hot-waterfall .ht_clone_top .dark-border-cell,
        .hot-waterfall .ht_clone_top .dark-border-cell td,
        .hot-waterfall .ht_clone_top .dark-border-cell th,
        .hot-waterfall .ht_clone_left .dark-border-cell,
        .hot-waterfall .ht_clone_left .dark-border-cell td,
        .hot-waterfall .ht_clone_left .dark-border-cell th,
        .hot-waterfall .ht_clone_left_top .dark-border-cell,
        .hot-waterfall .ht_clone_left_top .dark-border-cell td,
        .hot-waterfall .ht_clone_left_top .dark-border-cell th {
          border: 0.1px solid #000000 !important;
        }
        
        /* Ensure borders persist even when cells are being edited */
        .hot-waterfall .dark-border-cell input,
        .hot-waterfall .dark-border-cell textarea,
        .hot-waterfall .dark-border-cell .handsontableInput {
          border: 0.1px solid #000000 !important;
        }
        
        /* Apply borders to header cells for date, platform, and all month columns */
        .hot-waterfall thead th.dark-border-header,
        .hot-waterfall .ht_clone_top thead th.dark-border-header,
        .hot-waterfall .ht_clone_left_top thead th.dark-border-header {
          border: 0.1px solid #000000 !important;
        }
        
        /* Ensure outer edges have borders - leftmost columns get left border */
        .hot-waterfall tbody td:first-child,
        .hot-waterfall tbody td:nth-child(2),
        .hot-waterfall .ht_clone_left tbody td:first-child,
        .hot-waterfall .ht_clone_left tbody td:nth-child(2) {
          border-left: 0.1px solid #000000 !important;
        }
        
        /* Ensure outer edges have borders - topmost row gets top border */
        .hot-waterfall thead th {
          border-top: 0.1px solid #000000 !important;
        }
        .hot-waterfall .ht_clone_top thead th,
        .hot-waterfall .ht_clone_left_top thead th {
          border-top: 0.1px solid #000000 !important;
        }
        
        /* Ensure leftmost header columns have left border */
        .hot-waterfall thead th:first-child,
        .hot-waterfall thead th:nth-child(2),
        .hot-waterfall .ht_clone_top thead th:first-child,
        .hot-waterfall .ht_clone_top thead th:nth-child(2),
        .hot-waterfall .ht_clone_left_top thead th:first-child,
        .hot-waterfall .ht_clone_left_top thead th:nth-child(2) {
          border-left: 0.1px solid #000000 !important;
        }
        
        /* Comment indicator color */
        .hot-waterfall {
          --ht-comments-indicator-color:rgb(255, 0, 0) !important; /* blue color */
        }
      `}</style>
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
            
            // Get row metadata
            const metadata = getRowMetadata(row);
            const { periodIndex, platformIndex, isTotals, validMonthKeys } = metadata;
            
            // Determine if this column is a month data column (SO, Forecast, or SS)
            const summaryStart = 2 + months.length * 3;
            const isMonthColumn = col >= 2 && col < summaryStart;
            const isSummaryColumn = col >= summaryStart && col < summaryStart + SUMMARY_COLUMNS.length;
            
            // Calculate which month this column belongs to (if it's a month column)
            let monthIndex = -1;
            let isInValidMonth = false;
            if (isMonthColumn) {
              monthIndex = Math.floor((col - 2) / 3);
              if (monthIndex >= 0 && monthIndex < months.length) {
                const monthKey = months[monthIndex].key;
                isInValidMonth = validMonthKeys.has(monthKey);
              }
            }
            
            // Determine background color
            let bgColor = "";
            if (periodIndex >= 0) {
              if (isTotals) {
                // Totals rows: Yellow for valid months and summary columns
                if ((isMonthColumn && isInValidMonth) || isSummaryColumn) {
                  bgColor = "#FFFFE5";
                }
              } else if (platformIndex >= 0) {
                // Platform rows: Apply alternating colors by period (pink, green, pink, green...)
                // Only apply to valid month columns (not summary columns for platform rows)
                if (isMonthColumn && isInValidMonth) {
                  // Alternate by period: even periods = pink, odd periods = green
                  bgColor = periodIndex % 2 === 0 ? "#FFE5E5" : "#E5FFE5";
                }
              }
            }
            
            // Determine if this column should have dark borders
            // Dark borders for: date column (0), platform column (1), and valid month columns
            const shouldHaveDarkBorder = col === 0 || col === 1 || (isMonthColumn && isInValidMonth);
            
            // Add dark-border-cell class for cells that should have dark borders
            if (shouldHaveDarkBorder) {
              classNames.push("dark-border-cell");
            }
            
            // Set up renderer with background color
            if (col >= 2) {
              props.renderer = function(
                instance: any,
                td: HTMLTableCellElement,
                r: number,
                c: number,
                prop: any,
                value: any,
                cellProperties: any
              ) {
                // Apply background color if specified
                if (bgColor) {
                  td.style.backgroundColor = bgColor;
                } else if (isMonthColumn) {
                  // Clear background for invalid months
                  td.style.backgroundColor = "";
                }
                
                // Use the number renderer for formatting
                numberRenderer(instance, td, r, c, prop, value, cellProperties);
              };
            } else {
              // For date and platform columns (col 0 and 1), use text renderer
              props.renderer = function(
                instance: any,
                td: HTMLTableCellElement,
                r: number,
                c: number,
                prop: any,
                value: any,
                cellProperties: any
              ) {
                // Use default text renderer
                textRenderer(instance, td, r, c, prop, value, cellProperties);
              };
            }
            
            // Apply summary cell styling
            if (isSummaryColumn) {
              classNames.push("summary-cell");
            }
            
            // Apply totals row styling
            if (isTotals && col > 0) {
              classNames.push("totals-cell");
              if (col === 1) {
                classNames.push("totals-cell-label");
              }
            }
            
            // Mark date column clickable in edit mode
            if (editMode && col === 0) {
              classNames.push("date-deletable");
            }
            
            if (classNames.length > 0) {
              props.className = classNames.join(" ");
            }
            
            return props;
          }}
          afterOnCellMouseDown={(event: any, coords) => {
            if (!editMode) return;
            const { row, col } = coords;
            if (row == null || col == null) return;
            if (col !== 0) return;
            try {
              const table = hotTableRef.current?.hotInstance;
              const label = table?.getDataAtCell(row, 0);
              if (label && typeof label === "string") {
                if (event?.button === 2) {
                  // Right-click: delete
                  event.preventDefault?.();
                  const ok = window.confirm(`Delete records for "${label}"?\nThis can't be undone.`);
                  if (ok) onDateDelete?.(label);
                } else if (event?.button === 0) {
                  // Left-click: edit
                  let anchor: DateAnchor | undefined;
                  const target = (event?.target as HTMLElement | null)?.closest("td") as HTMLElement | null;
                  const rect = target?.getBoundingClientRect();
                  if (rect) {
                    anchor = {
                      top: rect.bottom + window.scrollY,
                      left: rect.left + window.scrollX,
                      width: rect.width,
                      height: rect.height,
                    };
                  }
                  onDateEdit?.(label, anchor);
                }
              }
            } catch {
              // ignore
            }
          }}
        />
      </div>
    </div>
  );
}
