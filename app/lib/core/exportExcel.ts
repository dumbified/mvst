/* eslint-disable @typescript-eslint/no-explicit-any */

import type Handsontable from "handsontable";
import {
  SUMMARY_COLUMNS,
  type MonthColumn,
  type RowMetadata,
} from "./waterfallTable";

// Use dynamic import to avoid server-side bundling issues
const loadExcelJS = async () => (await import("exceljs")).default;

type MergeCellSetting = {
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
};

type ExportWaterfallOptions = {
  hot: Handsontable;
  months: MonthColumn[];
  monthStartCol: number;
  mergeBodyCells: MergeCellSetting[];
  getRowMetadata: (row: number) => RowMetadata;
  cellCommentsMap: Map<string, { value: string }>;
  colWidths: number[] | undefined;
};

export async function exportWaterfallToExcel({
  hot,
  months,
  monthStartCol,
  mergeBodyCells,
  getRowMetadata,
  cellCommentsMap,
  colWidths,
}: ExportWaterfallOptions) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Demand Waterfall");

  const rowCount = hot.countRows();
  const colCount = hot.countCols();

  // Build header rows to mirror nested headers (with merges)
  const topRow: string[] = [];
  const secondRow: string[] = [];

  // Fixed first three columns
  topRow.push("Report Date", "Forecast load-ins date", "Platform");
  secondRow.push("", "", "");

  // Month groups: header merged across 3 columns, second row SO / Forecast / SS
  months.forEach((month) => {
    topRow.push(month.label, "", "");
    secondRow.push("SO", "Forecast", "SS");
  });

  // Summary group: merged header + individual summary column labels
  topRow.push("Summary", ...Array(Math.max(SUMMARY_COLUMNS.length - 1, 0)).fill(""));
  SUMMARY_COLUMNS.forEach((col) => {
    secondRow.push(col.label);
  });

  worksheet.addRow(topRow);
  worksheet.addRow(secondRow);

  // Merge header cells to match UI
  // First three columns: vertical merge across two header rows
  worksheet.mergeCells(1, 1, 2, 1); // Report Date
  worksheet.mergeCells(1, 2, 2, 2); // Forecast load-ins date
  worksheet.mergeCells(1, 3, 2, 3); // Platform

  // Month headers: merge horizontally in first header row
  for (let i = 0; i < months.length; i++) {
    const startCol = monthStartCol + i * 3 + 1; // convert 0-based to 1-based
    const endCol = startCol + 2;
    worksheet.mergeCells(1, startCol, 1, endCol);
  }

  // Summary header: merge horizontally in first header row
  const summaryStartCol0 = monthStartCol + months.length * 3;
  const summaryStartCol1 = summaryStartCol0 + 1;
  const summaryEndCol1 = summaryStartCol1 + SUMMARY_COLUMNS.length - 1;
  worksheet.mergeCells(1, summaryStartCol1, 1, summaryEndCol1);

  const headerRowCount = 2;

  // Helper to convert hex (#RRGGBB) to ARGB
  const hexToArgb = (hex: string) => {
    const cleaned = hex.replace("#", "");
    if (cleaned.length !== 6) return undefined;
    return `FF${cleaned.toUpperCase()}`;
  };

  // Write data rows, comments, background colors
  for (let r = 0; r < rowCount; r++) {
    const excelRowIndex = headerRowCount + 1 + r;
    const rowValues: (string | number | null)[] = [];
    for (let c = 0; c < colCount; c++) {
      const value = hot.getDataAtCell(r, c);
      rowValues[c + 1] = value === null || value === undefined ? "" : value;
    }
    const excelRow = worksheet.getRow(excelRowIndex);
    excelRow.values = rowValues;

    for (let c = 0; c < colCount; c++) {
      const cell = worksheet.getCell(excelRowIndex, c + 1);

      // Apply comments (as Excel notes)
      const commentKey = `${r},${c}`;
      const comment = cellCommentsMap.get(commentKey);
      if (comment?.value) {
        (cell as any).note = comment.value;
      }

      // Apply background colors similar to table logic
      const metadata = getRowMetadata(r);
      const { periodIndex, platformIndex, isTotals, validMonthKeys } = metadata;
      const summaryStartCol = monthStartCol + months.length * 3;
      const isMonthColumn = c >= monthStartCol && c < summaryStartCol;
      const isSummaryColumn = c >= summaryStartCol && c < summaryStartCol + SUMMARY_COLUMNS.length;

      let monthIndex = -1;
      let isInValidMonth = false;
      if (isMonthColumn) {
        monthIndex = Math.floor((c - monthStartCol) / 3);
        if (monthIndex >= 0 && monthIndex < months.length) {
          const monthKey = months[monthIndex].key;
          isInValidMonth = validMonthKeys.has(monthKey);
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

      if (bgColor) {
        const argb = hexToArgb(bgColor);
        if (argb) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb },
          };
        }
      }
    }
  }

  // Apply body merge cells (Created Date / Forecast load-ins date)
  if (Array.isArray(mergeBodyCells) && mergeBodyCells.length > 0) {
    mergeBodyCells.forEach((merge) => {
      const startRow = headerRowCount + 1 + merge.row;
      const endRow = startRow + merge.rowspan - 1;
      const startCol = merge.col + 1;
      const endCol = startCol + merge.colspan - 1;
      try {
        worksheet.mergeCells(startRow, startCol, endRow, endCol);
      } catch {
        // Ignore merge errors
      }
    });
  }

  // Apply thin black borders to all used cells
  const totalRows = worksheet.rowCount;
  for (let r = 1; r <= totalRows; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    }
  }

  // Approximate column widths based on existing widths
  if (Array.isArray(colWidths)) {
    worksheet.columns = colWidths.map((w: number) => ({
      width: Math.max(8, Math.round(w / 7)),
    }));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "demand-waterfall.xlsx");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


