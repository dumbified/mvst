'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState, useRef, useEffect } from "react";
import { HotTable } from "@handsontable/react-wrapper";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type Handsontable from "handsontable";
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { registerAllModules } from 'handsontable/registry';
import { PLATFORM_LABELS, PlatformKey, SalesOrderSummary } from "../lib/salesOrders";
import { ForecastSummary } from "../lib/forecasts";
import { DEFAULT_BOM_COSTS } from "../lib/constants";
import { textRenderer } from "handsontable/renderers/textRenderer";
import {
  MonthColumn,
  SUMMARY_COLUMNS,
  buildCellComments,
  buildDataRows,
  buildEffectivePeriods,
  computeMonths,
  createColumnWidths,
  createMergeCells,
  createNestedHeaders,
  createRowMetadataGetter,
  getRowsPerPeriod,
} from "../lib/waterfallTable";

registerAllModules();

const PLATFORM_OPTIONS: PlatformKey[] = [...PLATFORM_LABELS];

const TABLE_FONT_SIZE_PX = 10;

type DateAnchor = { top: number; left: number; width: number; height: number };

type DemandWaterfallTableProps = {
  salesOrdersList?: SalesOrderSummary[];
  forecastSummaryList?: ForecastSummary[];
  bomCosts?: Record<string, number>;
<<<<<<< HEAD
  onBomCostsChange?: (bomCosts: Record<string, number>) => void;
=======
  onBomCostsChange?: (costs: Record<string, number>) => void;
>>>>>>> b8578500210b092506a8649f796cc054a0f64e64
  editMode?: boolean;
  onDateEdit?: (dateLabel: string, anchor?: DateAnchor) => void;
  onDateDelete?: (dateLabel: string) => void;
};

export default function DemandWaterfallTable({
  salesOrdersList = [],
  forecastSummaryList = [],
<<<<<<< HEAD
  bomCosts: propBomCosts,
=======
  bomCosts = DEFAULT_BOM_COSTS,
>>>>>>> b8578500210b092506a8649f796cc054a0f64e64
  onBomCostsChange,
  editMode = false,
  onDateEdit,
  onDateDelete,
}: DemandWaterfallTableProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() => [...PLATFORM_OPTIONS]);
  const [showTotals, setShowTotals] = useState<boolean>(true);
  const hotTableRef = useRef<HotTableRef | null>(null);
  const getHotInstance = () => hotTableRef.current?.hotInstance as Handsontable | undefined;
  const bomEditorButtonRef = useRef<HTMLButtonElement>(null);
  const bomEditorPopupRef = useRef<HTMLDivElement>(null);
<<<<<<< HEAD
  const resolvedBomCosts = propBomCosts ?? DEFAULT_BOM_COSTS;
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [editingCosts, setEditingCosts] = useState<Record<string, string>>(() => {
    const obj: Record<string, string> = {};
    PLATFORM_OPTIONS.forEach((p) => (obj[p] = String(resolvedBomCosts[p] ?? 0)));
=======
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [editingCosts, setEditingCosts] = useState<Record<string, string>>(() => {
    const obj: Record<string, string> = {};
    PLATFORM_OPTIONS.forEach((p) => (obj[p] = String(bomCosts[p] ?? DEFAULT_BOM_COSTS[p] ?? 0)));
>>>>>>> b8578500210b092506a8649f796cc054a0f64e64
    return obj;
  });

  // Merge all months from uploads and forecasts
  const months = useMemo<MonthColumn[]>(
    () => computeMonths(salesOrdersList, forecastSummaryList),
    [salesOrdersList, forecastSummaryList],
  );

  const visiblePlatforms = useMemo(
    () => PLATFORM_OPTIONS.filter((platform) => selectedPlatforms.includes(platform)),
    [selectedPlatforms]
  );

<<<<<<< HEAD
=======
  // Update editing costs when bomCosts prop changes
  useEffect(() => {
    const asStrings: Record<string, string> = {};
    PLATFORM_OPTIONS.forEach((p) => (asStrings[p] = String(bomCosts[p] ?? DEFAULT_BOM_COSTS[p] ?? 0)));
    setEditingCosts(asStrings);
  }, [bomCosts]);

>>>>>>> b8578500210b092506a8649f796cc054a0f64e64
  const saveBomCosts = () => {
    const next: Record<string, number> = {};
    PLATFORM_OPTIONS.forEach((p) => {
      const v = Number(String(editingCosts[p] ?? "").replace(/,/g, ""));
      next[p] = Number.isFinite(v) ? v : 0;
    });
<<<<<<< HEAD
    // Call the parent callback to sync to remote storage
    if (onBomCostsChange) {
      onBomCostsChange(next);
    }
=======
    onBomCostsChange?.(next);
>>>>>>> b8578500210b092506a8649f796cc054a0f64e64
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

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditingCosts]);

  const effectivePeriods = useMemo(
    () => buildEffectivePeriods(salesOrdersList, forecastSummaryList),
    [salesOrdersList, forecastSummaryList],
  );

  const data = useMemo(
    () =>
      buildDataRows({
        effectivePeriods,
        forecastSummaryList,
        visiblePlatforms,
        months,
        bomCosts: resolvedBomCosts,
        showTotals,
      }),
    [resolvedBomCosts, effectivePeriods, forecastSummaryList, months, showTotals, visiblePlatforms],
  );

  const nestedHeaders = useMemo(() => createNestedHeaders(months), [months]);

  const colWidths = useMemo(() => createColumnWidths(months), [months]);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const rowsPerPeriod = useMemo(
    () => getRowsPerPeriod(showTotals, visiblePlatforms.length),
    [showTotals, visiblePlatforms],
  );

  const periodCount = effectivePeriods.length;

  const mergeBodyCells = useMemo(
    () => createMergeCells(periodCount, rowsPerPeriod),
    [periodCount, rowsPerPeriod],
  );

  // Helper to get row metadata (period, platform index, isTotals, valid months)
  const getRowMetadata = useMemo(
    () =>
      createRowMetadataGetter({
        effectivePeriods,
        rowsPerPeriod,
        showTotals,
      }),
    [effectivePeriods, rowsPerPeriod, showTotals],
  );

  const cellComments = useMemo(
    () =>
      buildCellComments({
        salesOrdersList,
        visiblePlatforms,
        months,
        showTotals,
      }),
    [months, salesOrdersList, showTotals, visiblePlatforms],
  );

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
      const hot = getHotInstance();
      if (hot) {
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
    const hot = getHotInstance();
    if (hot) {
      
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
                PLATFORM_OPTIONS.forEach((p) => (next[p] = String(resolvedBomCosts[p] ?? 0)));
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
              className="absolute right-0 top-full mt-2 min-w-[280px] p-2 rounded-md border border-neutral-300 bg-white shadow-lg z-[1001]"
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
              const table = getHotInstance();
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
