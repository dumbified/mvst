'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { HotTable } from "@handsontable/react-wrapper";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type Handsontable from "handsontable";
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { registerAllModules } from 'handsontable/registry';
import { SalesOrderSummary } from "../lib/data/salesOrders";
import { getBomCosts } from "../lib/core/constants";
import { ForecastSummary } from "../lib/data/forecasts";
import { getAllPlatforms } from "../lib/core/platformUtils";
import { textRenderer } from "handsontable/renderers/textRenderer";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  getPlatformsPerPeriod,
  generateCellCommentKey,
} from "../lib/core/waterfallTable";
import { fetchMachineIdData, buildMachineIdMap, PlatformMonthMachineIdMap } from "../lib/data/machineIds";
import { type CellComments } from "../lib/storage/stateStorage";

registerAllModules();

const TABLE_FONT_SIZE_PX = 10;

type DateAnchor = { top: number; left: number; width: number; height: number };

type DemandWaterfallTableProps = {
  salesOrdersList?: SalesOrderSummary[];
  forecastSummaryList?: ForecastSummary[];
  bomCosts?: Record<string, number>;
  cellComments?: CellComments;
  onCellCommentChange?: (key: string, value: string) => Promise<void>;
  editMode?: boolean;
  onDateEdit?: (dateLabel: string, anchor?: DateAnchor) => void;
  onDateDelete?: (id: number | string) => void; // Accept ID (number) or dateLabel (string) for backward compatibility
};

export default function DemandWaterfallTable({
  salesOrdersList = [],
  forecastSummaryList = [],
  bomCosts: propBomCosts,
  cellComments = {},
  onCellCommentChange,
  editMode = false,
  onDateEdit,
  onDateDelete,
}: DemandWaterfallTableProps) {
  const resolvedBomCosts = propBomCosts ?? getBomCosts();
  
  // Dynamically discover all platforms from data and settings
  const allPlatforms = useMemo(
    () => getAllPlatforms(salesOrdersList, forecastSummaryList, resolvedBomCosts),
    [salesOrdersList, forecastSummaryList, resolvedBomCosts]
  );
  
  // Track which platforms user has explicitly deselected
  const [deselectedPlatforms, setDeselectedPlatforms] = useState<Set<string>>(new Set());
  
  // Compute selected platforms as derived state (all platforms minus deselected ones)
  const selectedPlatforms = useMemo(() => {
    return allPlatforms.filter(platform => !deselectedPlatforms.has(platform));
  }, [allPlatforms, deselectedPlatforms]);
  
  const [showTotals, setShowTotals] = useState<boolean>(true);
  const hotTableRef = useRef<HotTableRef | null>(null);
  const getHotInstance = () => hotTableRef.current?.hotInstance as Handsontable | undefined;
  const [, setPlatformMonthMachineIdMap] = useState<PlatformMonthMachineIdMap | undefined>(undefined);
  
  // Function to toggle platform selection
  const togglePlatform = useCallback((platform: string) => {
    setDeselectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }, []);

  // Merge all months from uploads and forecasts
  const months = useMemo<MonthColumn[]>(
    () => computeMonths(salesOrdersList, forecastSummaryList),
    [salesOrdersList, forecastSummaryList],
  );

  // Fetch machine ID data on mount
  useEffect(() => {
    let cancelled = false;
    
    const loadMachineIds = async () => {
      try {
        const machineIdData = await fetchMachineIdData();
        
        if (!cancelled && machineIdData.length > 0) {
          const { platformMonthMap } = buildMachineIdMap(machineIdData, months);
          setPlatformMonthMachineIdMap(platformMonthMap);
        }
      } catch {
        // Failed to load machine IDs
      }
    };

    if (months.length > 0) {
      loadMachineIds();
    }

    return () => {
      cancelled = true;
    };
  }, [months]);

  const visiblePlatforms = useMemo(
    () => allPlatforms.filter((platform) => selectedPlatforms.includes(platform)),
    [allPlatforms, selectedPlatforms]
  );

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


  // Calculate platforms per period (only platforms that exist in each period's data)
  const platformsPerPeriod = useMemo(
    () => getPlatformsPerPeriod(effectivePeriods, forecastSummaryList, visiblePlatforms),
    [effectivePeriods, forecastSummaryList, visiblePlatforms],
  );

  // Calculate rows per period based on actual platforms in each period
  const rowsPerPeriod = useMemo(
    () => platformsPerPeriod.map(count => getRowsPerPeriod(showTotals, count)),
    [platformsPerPeriod, showTotals],
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

  const cellCommentsArray = useMemo(
    () =>
      buildCellComments({
        salesOrdersList,
        forecastSummaryList,
        visiblePlatforms,
        months,
        showTotals,
        customComments: cellComments,
      }),
    [months, salesOrdersList, forecastSummaryList, showTotals, visiblePlatforms, cellComments],
  );

  // Create reverse mapping from row/col to cell comment key for saving edited comments
  const rowColToCommentKey = useMemo(() => {
    const map = new Map<string, string>();
    const platformsPerPeriod = getPlatformsPerPeriod(salesOrdersList, forecastSummaryList, visiblePlatforms);
    const rowsPerPeriodArray = platformsPerPeriod.map(count => getRowsPerPeriod(showTotals, count));
    
    const cumulativeRows: number[] = [];
    let total = 0;
    rowsPerPeriodArray.forEach((count) => {
      cumulativeRows.push(total);
      total += count;
    });

    const forecastMap = new Map<string, ForecastSummary>();
    forecastSummaryList.forEach((fc) => {
      forecastMap.set(fc.uploadDateLabel, fc);
    });

    salesOrdersList.forEach((salesOrders, periodIndex) => {
      const periodMonthKeys = new Set(salesOrders.months.map((m) => m.key));
      const periodForecast = forecastMap.get(salesOrders.uploadDateLabel);

      const periodPlatforms = new Set<string>();
      Object.keys(salesOrders.totals).forEach(p => periodPlatforms.add(p));
      if (periodForecast) {
        Object.keys(periodForecast.totals).forEach(p => periodPlatforms.add(p));
      }
      const periodVisiblePlatforms = visiblePlatforms.filter(p => periodPlatforms.has(p));

      periodVisiblePlatforms.forEach((platform, platformIndex) => {
        const rowIndex = cumulativeRows[periodIndex] + platformIndex;

        months.forEach((month, monthIndex) => {
          if (!periodMonthKeys.has(month.key)) return;

          const colIndex = 2 + monthIndex * 3;
          
          // SO column
          const soKey = generateCellCommentKey(salesOrders.uploadDateLabel, platform, month.key, "so");
          map.set(`${rowIndex},${colIndex}`, soKey);
          
          // Forecast column
          const forecastColIndex = colIndex + 1;
          const forecastKey = generateCellCommentKey(salesOrders.uploadDateLabel, platform, month.key, "forecast");
          map.set(`${rowIndex},${forecastColIndex}`, forecastKey);
        });
      });
    });

    return map;
  }, [salesOrdersList, forecastSummaryList, visiblePlatforms, months, showTotals]);

  // Convert comments array to a Map for quick lookup
  const cellCommentsMap = useMemo(() => {
    const map = new Map<string, { value: string }>();
    cellCommentsArray.forEach((comment) => {
      const key = `${comment.row},${comment.col}`;
      map.set(key, comment.comment);
    });
    return map;
  }, [cellCommentsArray]);

  // Set comments using Handsontable API after table is ready
  useEffect(() => {
    const hot = getHotInstance();
    if (!hot || cellCommentsMap.size === 0) {
      return;
    }
    
    cellCommentsMap.forEach((comment, key) => {
      const [row, col] = key.split(',').map(Number);
      try {
        hot.setCellMeta(row, col, 'comment', comment);
      } catch {
        // Error setting comment
      }
    });
    
    // Force render to show comment indicators
    setTimeout(() => {
      hot.render();
    }, 100);
  }, [cellCommentsMap, data]);

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
            } catch {
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

      // Handle comment editing - extract custom comment and save it
      const handleAfterSetCellMeta = (row: number, col: number, key: string, value: any) => {
        if (key === 'comment' && onCellCommentChange) {
          const commentKey = rowColToCommentKey.get(`${row},${col}`);
          if (commentKey) {
            const commentValue = value?.value || "";
            
            // Parse comment key to get original job numbers
            const [uploadDateLabel, platform, monthKey, columnType] = commentKey.split(":");
            let originalJobNumbers: string[] = [];
            
            if (columnType === "so") {
              // Get job numbers from sales orders
              const salesOrder = salesOrdersList.find(so => so.uploadDateLabel === uploadDateLabel);
              if (salesOrder) {
                const bucket = salesOrder.totals[platform]?.[monthKey];
                if (bucket) {
                  originalJobNumbers = bucket.jobNumbers || [];
                }
              }
            } else if (columnType === "forecast") {
              // Get machine IDs from forecast
              const forecast = forecastSummaryList.find(fc => fc.uploadDateLabel === uploadDateLabel);
              if (forecast) {
                originalJobNumbers = forecast.machineIds?.[platform]?.[monthKey] || [];
              }
            }
            
            // Extract custom comment by removing original job numbers
            let customComment = "";
            if (commentValue.trim()) {
              const originalJobNumbersText = originalJobNumbers.join("\n");
              const lines = commentValue.split("\n").map((l: string) => l.trim()).filter((l: string) => l);
              
              // Check if comment contains "[Note: " marker
              const noteMatch = commentValue.match(/\[Note:\s*(.+?)\]\s*$/);
              if (noteMatch) {
                // Extract custom comment from note marker
                customComment = noteMatch[1].trim();
              } else if (originalJobNumbersText) {
                // Remove original job numbers and get remaining text
                const originalLines = originalJobNumbersText.split("\n").map(l => l.trim()).filter(l => l);
                const customLines = lines.filter((line: string) => !originalLines.includes(line));
                if (customLines.length > 0) {
                  customComment = customLines.join("\n").trim();
                }
              } else {
                // No original job numbers, entire comment is custom
                customComment = commentValue.trim();
              }
            }
            
            // Save custom comment (empty string removes it)
            onCellCommentChange(commentKey, customComment);
          }
        }
      };
      
      hot.addHook('afterChange', handleAfterChange);
      hot.addHook('afterSelectionEnd', handleAfterSelectionEnd);
      hot.addHook('afterBeginEditing', handleAfterBeginEditing);
      hot.addHook('afterSetCellMeta', handleAfterSetCellMeta);
      
      return () => {
        hot.removeHook('afterChange', handleAfterChange);
        hot.removeHook('afterSelectionEnd', handleAfterSelectionEnd);
        hot.removeHook('afterBeginEditing', handleAfterBeginEditing);
        hot.removeHook('afterSetCellMeta', handleAfterSetCellMeta);
      };
    }
  }, [data, months, selectedPlatforms, getRowMetadata, editMode, reapplyBorders, rowColToCommentKey, onCellCommentChange, salesOrdersList, forecastSummaryList]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-xs font-medium text-neutral-600">Filter by Platforms:</span>
        <div className="flex items-center gap-2 flex-wrap">
          {allPlatforms.map((platform) => (
            <Label
              key={platform}
              htmlFor={`platform-${platform}`}
              className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-neutral-100"
            >
              <Checkbox
                id={`platform-${platform}`}
                checked={selectedPlatforms.includes(platform)}
                onCheckedChange={() => togglePlatform(platform)}
              />
              <span className="text-xs text-neutral-700">{platform}</span>
            </Label>
          ))}
        </div>
        <div className="h-4 w-px bg-neutral-300 mx-1" />
        <Label
          htmlFor="show-totals"
          className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-neutral-100"
        >
          <Checkbox
            id="show-totals"
            checked={showTotals}
            onCheckedChange={(checked) => setShowTotals(checked === true)}
          />
          <span className="text-xs text-neutral-700">Totals</span>
        </Label>
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
      <div className="bg-white" style={{ height: 'auto', width: "100%" }}>
        <HotTable
          ref={hotTableRef}
          data={data}
          colHeaders={true}
          nestedHeaders={nestedHeaders as any}
          rowHeaders={false}
          colWidths={colWidths}
          fixedColumnsStart={2}
          rowHeights={24}
          height={690}
          stretchH="all"
          className="hot-waterfall ht-theme-main"
          licenseKey="non-commercial-and-evaluation"
          mergeCells={mergeBodyCells}
          comments={true}
          cells={(row, col) => {
            const props: any = {};
            const classNames: string[] = [];
            
            // Check if this cell has a comment
            const commentKey = `${row},${col}`;
            const comment = cellCommentsMap.get(commentKey);
            if (comment) {
              props.comment = comment;
            }
            
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
              const metadata = getRowMetadata(row);
              const { periodIndex } = metadata;
              
              if (label && typeof label === "string" && periodIndex >= 0 && periodIndex < salesOrdersList.length) {
                const upload = salesOrdersList[periodIndex];
                const uploadId = upload.id;
                
                if (event?.button === 2) {
                  // Right-click: delete
                  event.preventDefault?.();
                  if (uploadId !== undefined) {
                    const ok = window.confirm(`Delete upload #${uploadId} (${label})?\nThis can't be undone.`);
                    if (ok) onDateDelete?.(uploadId);
                  } else {
                    // Fallback to dateLabel for backward compatibility
                    const ok = window.confirm(`Delete records for "${label}"?\nThis can't be undone.`);
                    if (ok) onDateDelete?.(label as any);
                  }
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