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
import { exportWaterfallToExcel } from "../lib/core/exportExcel";
import { fetchMachineIdData, buildMachineIdMap, PlatformMonthMachineIdMap } from "../lib/data/machineIds";
import { type CellComments } from "../lib/storage/stateStorage";
import { parseDateLabel } from "../lib/utils/dateUtils";

registerAllModules();

const TABLE_FONT_SIZE_PX = 10;
const MONTH_START_COL = 3; // Created Date | Forecast load-ins date | Platform

type DateAnchor = { top: number; left: number; width: number; height: number };

type DemandWaterfallTableProps = {
  salesOrdersList?: SalesOrderSummary[];
  forecastSummaryList?: ForecastSummary[];
  bomCosts?: Record<string, number>;
  cellComments?: CellComments;
  onCellCommentChange?: (key: string, value: string) => Promise<void>;
  editMode?: boolean;
  deleteMode?: boolean;
  onDateEdit?: (key: number | string, dateLabel: string, anchor?: DateAnchor) => void;
  onDateDelete?: (id: number | string) => void; // Accept ID (number) or dateLabel (string) for backward compatibility
  onBatchDelete?: (ids: (number | string)[]) => void; // Batch delete multiple uploads at once
};

export default function DemandWaterfallTable({
  salesOrdersList = [],
  forecastSummaryList = [],
  bomCosts: propBomCosts,
  cellComments = {},
  onCellCommentChange,
  editMode = false,
  deleteMode = false,
  onDateEdit,
  onDateDelete,
  onBatchDelete,
}: DemandWaterfallTableProps) {
  const resolvedBomCosts = propBomCosts ?? getBomCosts();
  
  const allPlatforms = useMemo(
    () => getAllPlatforms(salesOrdersList, forecastSummaryList, resolvedBomCosts),
    [salesOrdersList, forecastSummaryList, resolvedBomCosts]
  );
  
  const [deselectedPlatforms, setDeselectedPlatforms] = useState<Set<string>>(new Set());
  
  const selectedPlatforms = useMemo(() => {
    return allPlatforms.filter(platform => !deselectedPlatforms.has(platform));
  }, [allPlatforms, deselectedPlatforms]);
  
  const [showTotals, setShowTotals] = useState<boolean>(true);
  const hotTableRef = useRef<HotTableRef | null>(null);
  const getHotInstance = () => hotTableRef.current?.hotInstance as Handsontable | undefined;
  const [, setPlatformMonthMachineIdMap] = useState<PlatformMonthMachineIdMap | undefined>(undefined);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  const [selectedUploads, setSelectedUploads] = useState<Set<number | string>>(new Set());
  
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

  const months = useMemo<MonthColumn[]>(
    () => computeMonths(salesOrdersList, forecastSummaryList),
    [salesOrdersList, forecastSummaryList],
  );

  const uniqueUploads = useMemo(() => {
    const uploadMap = new Map<number | string, { id: number | string; label: string; date: Date | null }>();
    
    salesOrdersList.forEach((so) => {
      const key = so.id ?? so.uploadDateLabel;
      if (!uploadMap.has(key)) {
        uploadMap.set(key, {
          id: so.id ?? so.uploadDateLabel,
          label: so.uploadDateLabel,
          date: parseDateLabel(so.uploadDateLabel),
        });
      }
    });
    
    forecastSummaryList.forEach((fc) => {
      const key = fc.id ?? fc.uploadDateLabel;
      if (!uploadMap.has(key)) {
        uploadMap.set(key, {
          id: fc.id ?? fc.uploadDateLabel,
          label: fc.uploadDateLabel,
          date: parseDateLabel(fc.uploadDateLabel),
        });
      }
    });
    
    return Array.from(uploadMap.values()).sort((a, b) => {
      if (a.date && b.date) {
        return b.date.getTime() - a.date.getTime();
      }
      if (a.date) return -1;
      if (b.date) return 1;
      return b.label.localeCompare(a.label);
    });
  }, [salesOrdersList, forecastSummaryList]);

  const toggleUploadSelection = useCallback((uploadId: number | string) => {
    setSelectedUploads(prev => {
      const next = new Set(prev);
      if (next.has(uploadId)) {
        next.delete(uploadId);
      } else {
        next.add(uploadId);
      }
      return next;
    });
  }, []);

  const selectAllUploads = useCallback(() => {
    setSelectedUploads(new Set(uniqueUploads.map(u => u.id)));
  }, [uniqueUploads]);

  const deselectAllUploads = useCallback(() => {
    setSelectedUploads(new Set());
  }, []);

  const handleMassDelete = useCallback(async () => {
    if (selectedUploads.size === 0) return;
    
    const count = selectedUploads.size;
    const confirmMessage = `Delete ${count} upload${count > 1 ? 's' : ''}?\nThis can't be undone.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    const idsToDelete = Array.from(selectedUploads);
    
    setSelectedUploads(new Set());
    
    if (onBatchDelete) {
      await onBatchDelete(idsToDelete);
    } else if (onDateDelete) {
      for (const id of idsToDelete) {
        try {
          await onDateDelete(id);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to delete upload ${id}:`, error);
        }
      }
    }
  }, [selectedUploads, onBatchDelete, onDateDelete]);

  const prevDeleteModeRef = useRef(deleteMode);
  useEffect(() => {
    const wasInDeleteMode = prevDeleteModeRef.current;
    prevDeleteModeRef.current = deleteMode;
    
    if (wasInDeleteMode && !deleteMode) {
      requestAnimationFrame(() => {
        setSelectedUploads(new Set());
      });
    }
  }, [deleteMode]);

  useEffect(() => {
    if (deleteMode) {
      const hot = getHotInstance();
      if (hot) {
        setTimeout(() => {
          hot.render();
        }, 0);
      }
    }
  }, [selectedUploads, deleteMode]);

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
        // ignore
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

  const summaryStart = useMemo(() => MONTH_START_COL + months.length * 3, [months.length]);
  
  const collapsibleColumns = useMemo(() => {
    if (SUMMARY_COLUMNS.length <= 1) return [];
    
    return [
      {
        row: -2, // Top header row (2 rows up from first data row, which is row 0 in nestedHeaders)
        col: summaryStart, // First column of Summary section (where "Summary" header starts)
        collapsible: true,
      },
    ];
  }, [summaryStart]);

  const platformsPerPeriod = useMemo(
    () => getPlatformsPerPeriod(effectivePeriods, forecastSummaryList, visiblePlatforms),
    [effectivePeriods, forecastSummaryList, visiblePlatforms],
  );

  const rowsPerPeriod = useMemo(
    () => platformsPerPeriod.map(count => getRowsPerPeriod(showTotals, count)),
    [platformsPerPeriod, showTotals],
  );

  const periodCount = effectivePeriods.length;

  const mergeBodyCells = useMemo(
    () => createMergeCells(periodCount, rowsPerPeriod),
    [periodCount, rowsPerPeriod],
  );

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

        const colIndex = MONTH_START_COL + monthIndex * 3;
          
          const soKey = generateCellCommentKey(salesOrders.uploadDateLabel, platform, month.key, "so");
          map.set(`${rowIndex},${colIndex}`, soKey);
          
          const forecastColIndex = colIndex + 1;
          const forecastKey = generateCellCommentKey(salesOrders.uploadDateLabel, platform, month.key, "forecast");
          map.set(`${rowIndex},${forecastColIndex}`, forecastKey);
        });
      });
    });

    return map;
  }, [salesOrdersList, forecastSummaryList, visiblePlatforms, months, showTotals]);

  const rowPlatformMap = useMemo(() => {
    const map = new Map<number, string>();
    const rowsPerPeriodArray = rowsPerPeriod;

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

    effectivePeriods.forEach((salesOrders, periodIndex) => {
      const periodForecast = forecastMap.get(salesOrders.uploadDateLabel);

      const periodPlatforms = new Set<string>();
      Object.keys(salesOrders.totals).forEach((p) => periodPlatforms.add(p));
      if (periodForecast) {
        Object.keys(periodForecast.totals).forEach((p) => periodPlatforms.add(p));
      }
      const periodVisiblePlatforms = visiblePlatforms.filter((p) => periodPlatforms.has(p));

      periodVisiblePlatforms.forEach((platform, platformIndex) => {
        const rowIndex = cumulativeRows[periodIndex] + platformIndex;
        map.set(rowIndex, platform);
      });
    });

    return map;
  }, [effectivePeriods, forecastSummaryList, visiblePlatforms, rowsPerPeriod]);

  const cellCommentsMap = useMemo(() => {
    const map = new Map<string, { value: string }>();
    cellCommentsArray.forEach((comment) => {
      const key = `${comment.row},${comment.col}`;
      map.set(key, comment.comment);
    });
    return map;
  }, [cellCommentsArray]);

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
        // ignore
      }
    });
    
    setTimeout(() => {
      hot.render();
    }, 100);
  }, [cellCommentsMap, data]);

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

  const reapplyBorders = useMemo(() => {
    return () => {
      const hot = getHotInstance();
      if (hot) {
        const container = hot.rootElement;
        if (!container) return;
        
        const allHeaderCells = container.querySelectorAll('thead th, .ht_clone_top thead th, .ht_clone_left_top thead th');
        allHeaderCells.forEach((cell: any) => {
          if (!cell.classList.contains('summary-header') && !cell.classList.contains('summary-subheader')) {
            cell.classList.add("dark-border-header");
            cell.style.border = "0.1px solid #000000";
          } else {
            cell.classList.remove("dark-border-header");
          }
        });
        
        const totalRows = hot.countRows();
        const summaryStart = MONTH_START_COL + months.length * 3;
        
        for (let row = 0; row < totalRows; row++) {
          const metadata = getRowMetadata(row);
          const { validMonthKeys } = metadata;
          
          for (let col = 0; col < hot.countCols(); col++) {
            try {
              const cell = hot.getCell(row, col);
              if (cell) {
                const isMonthColumn = col >= MONTH_START_COL && col < summaryStart;
                let isInValidMonth = false;
                if (isMonthColumn) {
                  const monthIndex = Math.floor((col - MONTH_START_COL) / 3);
                  if (monthIndex >= 0 && monthIndex < months.length) {
                    const monthKey = months[monthIndex].key;
                    isInValidMonth = validMonthKeys.has(monthKey);
                  }
                }
                
                const shouldHaveDarkBorder = col === 0 || col === 1 || col === 2 || (isMonthColumn && isInValidMonth);
                
                if (shouldHaveDarkBorder) {
                  cell.classList.add("dark-border-cell");
                  cell.style.border = "0.1px solid #000000";
                } else {
                  cell.classList.remove("dark-border-cell");
                  if (isMonthColumn) {
                    cell.style.border = "";
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }
    };
  }, [months, getRowMetadata]);

  useEffect(() => {
    const hot = getHotInstance();
    if (hot) {
      const container = hot.rootElement;
      if (container) {
        const headerCells = container.querySelectorAll('thead th, .ht_clone_top thead th, .ht_clone_left_top thead th');
        const headerFontSize = `${TABLE_FONT_SIZE_PX}px`;
        headerCells.forEach((cell: any) => {
          if (cell) {
            cell.style.fontSize = headerFontSize;
            cell.style.fontWeight = 'bold';
            const nested = cell.querySelectorAll('*');
            nested.forEach((el: any) => {
              el.style.fontSize = headerFontSize;
            });
          }
        });
      }
      
      const handleAfterCollapse = () => {
        try {
          const collapsiblePlugin = hot.getPlugin('collapsibleColumns');
          if (collapsiblePlugin) {
            const summaryStartCol = summaryStart;
            const firstSummaryCol = summaryStartCol;
            
            const hiddenCols = (collapsiblePlugin as any).getHiddenColumns?.() || [];
            
            if (hiddenCols.includes(firstSummaryCol)) {
              (collapsiblePlugin as any).showColumns?.([firstSummaryCol]);
            }
          }
        } catch {
          // ignore
        }
        setTimeout(() => reapplyBorders(), 0);
      };
      
      const handleAfterExpand = () => {
        setTimeout(() => reapplyBorders(), 0);
      };
      
      reapplyBorders();
      
      const initializeCollapsedState = () => {
        try {
          if (SUMMARY_COLUMNS.length > 1) {
            const summaryStartCol = summaryStart;
            const columnsToHide: number[] = [];
            for (let i = 1; i < SUMMARY_COLUMNS.length; i++) {
              columnsToHide.push(summaryStartCol + i);
            }
            if (columnsToHide.length > 0) {
              const hiddenColumnsPlugin = hot.getPlugin('hiddenColumns');
              if (hiddenColumnsPlugin) {
                (hiddenColumnsPlugin as any).hideColumns?.(columnsToHide);
              } else {
                const collapsiblePlugin = hot.getPlugin('collapsibleColumns');
                if (collapsiblePlugin) {
                  (collapsiblePlugin as any).hideColumns?.(columnsToHide);
                }
              }
              setTimeout(() => {
                hot.render();
                reapplyBorders();
              }, 50);
            }
          }
        } catch {
          // ignore
        }
      };
      
      setTimeout(initializeCollapsedState, 200);
      
      const handleAfterChange = () => {
        setTimeout(() => reapplyBorders(), 0);
      };
      
      const handleAfterSelectionEnd = () => {
        setTimeout(() => reapplyBorders(), 0);
      };

      const handleAfterBeginEditing = () => {
        setTimeout(() => reapplyBorders(), 0);
      };

      const handleAfterSetCellMeta = (row: number, col: number, key: string, value: any) => {
        if (key === 'comment' && onCellCommentChange) {
          const commentKey = rowColToCommentKey.get(`${row},${col}`);
          if (commentKey) {
            const commentValue = value?.value || "";
            
            const [uploadDateLabel, platform, monthKey, columnType] = commentKey.split(":");
            let originalJobNumbers: string[] = [];
            
            if (columnType === "so") {
              const salesOrder = salesOrdersList.find(so => so.uploadDateLabel === uploadDateLabel);
              if (salesOrder) {
                const bucket = salesOrder.totals[platform]?.[monthKey];
                if (bucket) {
                  originalJobNumbers = bucket.jobNumbers || [];
                }
              }
            } else if (columnType === "forecast") {
              const forecast = forecastSummaryList.find(fc => fc.uploadDateLabel === uploadDateLabel);
              if (forecast) {
                originalJobNumbers = forecast.machineIds?.[platform]?.[monthKey] || [];
              }
            }
            
            let customComment = "";
            if (commentValue.trim()) {
              const originalJobNumbersText = originalJobNumbers.join("\n");
              const lines = commentValue.split("\n").map((l: string) => l.trim()).filter((l: string) => l);
              
              const noteMatch = commentValue.match(/\[Note:\s*(.+?)\]\s*$/);
              if (noteMatch) {
                customComment = noteMatch[1].trim();
              } else if (originalJobNumbersText) {
                const originalLines = originalJobNumbersText.split("\n").map(l => l.trim()).filter(l => l);
                const customLines = lines.filter((line: string) => !originalLines.includes(line));
                if (customLines.length > 0) {
                  customComment = customLines.join("\n").trim();
                }
              } else {
                customComment = commentValue.trim();
              }
            }
            
            onCellCommentChange(commentKey, customComment);
          }
        }
      };
      
      hot.addHook('afterChange', handleAfterChange);
      hot.addHook('afterSelectionEnd', handleAfterSelectionEnd);
      hot.addHook('afterBeginEditing', handleAfterBeginEditing);
      hot.addHook('afterSetCellMeta', handleAfterSetCellMeta);
      hot.addHook('afterHideColumns', handleAfterCollapse);
      hot.addHook('afterUnhideColumns', handleAfterExpand);
      
      return () => {
        hot.removeHook('afterChange', handleAfterChange);
        hot.removeHook('afterSelectionEnd', handleAfterSelectionEnd);
        hot.removeHook('afterBeginEditing', handleAfterBeginEditing);
        hot.removeHook('afterSetCellMeta', handleAfterSetCellMeta);
        hot.removeHook('afterHideColumns', handleAfterCollapse);
        hot.removeHook('afterUnhideColumns', handleAfterExpand);
      };
    }
  }, [data, months, selectedPlatforms, getRowMetadata, editMode, reapplyBorders, rowColToCommentKey, onCellCommentChange, salesOrdersList, forecastSummaryList, summaryStart]);

  const handleExportExcel = async () => {
    if (isExporting) return;
    const hot = getHotInstance();
    if (!hot || !data.length) return;
    setIsExporting(true);
    try {
      await exportWaterfallToExcel({
        hot,
        months,
        monthStartCol: MONTH_START_COL,
        mergeBodyCells,
        getRowMetadata,
        cellCommentsMap,
        colWidths,
      });
    } catch {
      // ignore
    } finally {
      setIsExporting(false);
    }
  };

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
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!data.length || !!isExporting}
            className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              !data.length || !!isExporting
                ? "border-neutral-200 text-neutral-400 bg-neutral-100 cursor-not-allowed"
                : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100"
            }`}
          >
            Export to Excel
          </button>
        </div>
      </div>

      {/* Mass Delete Controls */}
      {deleteMode && uniqueUploads.length > 0 && (
        <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-red-700">Select Uploads to Delete:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllUploads}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select All
                </button>
                <span className="text-red-300">|</span>
                <button
                  type="button"
                  onClick={deselectAllUploads}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {uniqueUploads.map((upload) => (
                <Label
                  key={upload.id}
                  htmlFor={`upload-${upload.id}`}
                  className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-red-100 bg-white border border-red-200"
                >
                  <Checkbox
                    id={`upload-${upload.id}`}
                    checked={selectedUploads.has(upload.id)}
                    onCheckedChange={() => toggleUploadSelection(upload.id)}
                  />
                  <span className="text-xs text-neutral-700">{upload.label}</span>
                </Label>
              ))}
            </div>
          </div>
          {selectedUploads.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMassDelete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded border border-red-700 transition-colors"
              >
                Delete Selected ({selectedUploads.size})
              </button>
            </div>
          )}
        </div>
      )}

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
        
        /* Quantity/job list mismatch indicator */
        .hot-waterfall .qty-mismatch {
          position: relative;
          background-color: #fff7ed !important;
        }
        .hot-waterfall .qty-mismatch::after {
          content: "!";
          position: absolute;
          top: 2px;
          right: 2px;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #f97316;
          color: #ffffff;
          font-weight: 700;
          font-size: 9px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
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
          fixedColumnsStart={MONTH_START_COL}
          rowHeights={24}
          height={690}
          stretchH="all"
          className="hot-waterfall ht-theme-main"
          licenseKey="non-commercial-and-evaluation"
          mergeCells={mergeBodyCells}
          comments={true}
          collapsibleColumns={collapsibleColumns as any}
          cells={(row, col) => {
            const props: any = {};
            const classNames: string[] = [];
            
            const commentKey = `${row},${col}`;
            const comment = cellCommentsMap.get(commentKey);
            if (comment) {
              props.comment = comment;
            }
            
            const metadata = getRowMetadata(row);
            const { periodIndex, platformIndex, isTotals, validMonthKeys } = metadata;
            const platformForRow = rowPlatformMap.get(row);
            
            const summaryStart = MONTH_START_COL + months.length * 3;
            const isMonthColumn = col >= MONTH_START_COL && col < summaryStart;
            const isSummaryColumn = col >= summaryStart && col < summaryStart + SUMMARY_COLUMNS.length;
            
            let monthIndex = -1;
            let isInValidMonth = false;
            if (isMonthColumn) {
              monthIndex = Math.floor((col - MONTH_START_COL) / 3);
              if (monthIndex >= 0 && monthIndex < months.length) {
                const monthKey = months[monthIndex].key;
                isInValidMonth = validMonthKeys.has(monthKey);
              }
            }

            const isSoColumn = isMonthColumn && ((col - MONTH_START_COL) % 3 === 0);
            let hasQtyMismatch = false;
            let mismatchTitle: string | undefined;
            if (
              isSoColumn &&
              platformForRow &&
              !isTotals &&
              isInValidMonth &&
              monthIndex >= 0 &&
              periodIndex >= 0
            ) {
              const monthKey = months[monthIndex].key;
              const period = effectivePeriods[periodIndex];
              const bucket = period?.totals?.[platformForRow]?.[monthKey];
              if (bucket) {
                const quantity = Number(bucket.quantity ?? 0);
                const jobCount = bucket.jobNumbers?.length ?? 0;
                if (quantity !== jobCount) {
                  hasQtyMismatch = true;
                  mismatchTitle = `Quantity ${quantity} differs from job list count ${jobCount}`;
                }
              }
            }
            
            const isForecastColumn = isMonthColumn && ((col - MONTH_START_COL) % 3 === 1);
            if (
              isForecastColumn &&
              platformForRow &&
              !isTotals &&
              isInValidMonth &&
              monthIndex >= 0 &&
              periodIndex >= 0
            ) {
              const monthKey = months[monthIndex].key;
              const period = effectivePeriods[periodIndex];
              const periodForecast = forecastSummaryList.find(
                (fc) => fc.uploadDateLabel === period.uploadDateLabel
              );
              if (periodForecast) {
                const quantity = Number(periodForecast.totals?.[platformForRow]?.[monthKey] ?? 0);
                const machineIdCount = periodForecast.machineIds?.[platformForRow]?.[monthKey]?.length ?? 0;
                if (quantity !== machineIdCount) {
                  hasQtyMismatch = true;
                  mismatchTitle = `Quantity ${quantity} differs from machine ID count ${machineIdCount}`;
                }
              }
            }
            
            let bgColor = "";
            if (periodIndex >= 0) {
              if (isTotals) {
                if ((isMonthColumn && isInValidMonth) || isSummaryColumn) {
                  bgColor = "#FFFFE5";
                }
              } else if (platformIndex >= 0) {
                if (isMonthColumn && isInValidMonth) {
                  bgColor = periodIndex % 2 === 0 ? "#FFE5E5" : "#E5FFE5";
                }
              }
            }
            
            if (deleteMode && col === 0) {
              const label = data[row]?.[0];
              if (label && typeof label === "string") {
                const soUpload = salesOrdersList.find((so) => so.uploadDateLabel === label);
                const fcUpload = forecastSummaryList.find((fc) => fc.uploadDateLabel === label);
                const upload = soUpload ?? fcUpload;
                const uploadId = upload?.id ?? label;
                if (selectedUploads.has(uploadId)) {
                  bgColor = "#DBEAFE";
                }
              }
            }
            
            const shouldHaveDarkBorder = col === 0 || col === 1 || col === 2 || (isMonthColumn && isInValidMonth);
            
            if (shouldHaveDarkBorder) {
              classNames.push("dark-border-cell");
            }
            
            if (col >= MONTH_START_COL) {
              props.renderer = function(
                instance: any,
                td: HTMLTableCellElement,
                r: number,
                c: number,
                prop: any,
                value: any,
                cellProperties: any
              ) {
                if (bgColor) {
                  td.style.backgroundColor = bgColor;
                } else if (isMonthColumn) {
                  td.style.backgroundColor = "";
                }
                
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
                if (bgColor) {
                  td.style.backgroundColor = bgColor;
                }
                textRenderer(instance, td, r, c, prop, value, cellProperties);
              };
            }
            
            if (isSummaryColumn) {
              classNames.push("summary-cell");
            }

            if (hasQtyMismatch) {
              classNames.push("qty-mismatch");
              if (!props.title) {
                props.title = mismatchTitle;
              }
            }
            
            if (isTotals && col > 1) {
              classNames.push("totals-cell");
              if (col === 2) {
                classNames.push("totals-cell-label");
              }
            }
            
            if ((editMode || deleteMode) && col === 0) {
              classNames.push("date-deletable");
            }
            
            if (classNames.length > 0) {
              props.className = classNames.join(" ");
            }
            
            return props;
          }}
          afterOnCellMouseDown={(event: any, coords) => {
            if (!editMode && !deleteMode) return;
            const { row, col } = coords;
            if (row == null || col == null) return;
            if (col !== 0) return;
            try {
              const table = getHotInstance();
              const label = table?.getDataAtCell(row, 0);
              const metadata = getRowMetadata(row);
              const { periodIndex } = metadata;
              
              if (label && typeof label === "string" && periodIndex >= 0) {
                const soUpload = salesOrdersList.find((so) => so.uploadDateLabel === label);
                const fcUpload = forecastSummaryList.find((fc) => fc.uploadDateLabel === label);
                const upload = soUpload ?? fcUpload;
                const uploadId = upload?.id ?? label;
                
                if (deleteMode && event?.button === 0) {
                  event.preventDefault?.();
                  toggleUploadSelection(uploadId);
                } else if (editMode && event?.button === 0) {
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
                  const keyForEdit: number | string = uploadId;
                  onDateEdit?.(keyForEdit, label, anchor);
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