import {
  SalesOrderBucket,
  SalesOrderSummary,
  formatMonthLabel,
} from "./salesOrders";
import { ForecastSummary } from "./forecasts";

export type MonthColumn = { key: string; label: string };

export const SUMMARY_COLUMNS: { key: string; label: string }[] = [
  { key: "currTotalSo", label: "Current total SO" },
  { key: "currTotalFcst", label: "Current total f'cst" },
  { key: "ttlDmd", label: "Ttl Dmd" },
  { key: "bomCostRm", label: "BOM Cost (RM)" },
  { key: "currTotalSoRm", label: "Current total SO (RM)" },
  { key: "currTotalFcstRm", label: "Current total f'cst (RM)" },
  { key: "ttlDmdRm", label: "Ttl Dmd (RM)" },
];


export type RowMetadata = {
  periodIndex: number;
  platformIndex: number;
  isTotals: boolean;
  validMonthKeys: Set<string>;
};

type HeaderCell = string | {
  label: string;
  colspan?: number;
  className?: string;
};

type NestedHeaders = HeaderCell[][];

type MergeCellSetting = {
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
};

export function computeMonths(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
): MonthColumn[] {
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

  if (monthSet.size === 0) return [];

  return Array.from(monthSet)
    .sort()
    .map((key) => ({
      key,
      label: labelMap.get(key) ?? formatMonthLabel(key),
    }));
}

export function buildEffectivePeriods(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
): SalesOrderSummary[] {
  if (salesOrdersList.length > 0) {
    return salesOrdersList;
  }

  if (forecastSummaryList.length > 0) {
    return forecastSummaryList.map((fc) => {
      // Use platforms from the forecast data itself (supports dynamic platforms)
      const platforms = Object.keys(fc.totals);
      const totals = platforms.reduce(
        (acc, platform) => ({
          ...acc,
          [platform]: {},
        }),
        {} as Record<string, Record<string, SalesOrderBucket>>,
      );
      return {
        uploadDateLabel: fc.uploadDateLabel,
        months: fc.months,
        totals,
      };
    });
  }

  return [];
}

export function getRowsPerPeriod(showTotals: boolean, platformCount: number) {
  if (platformCount === 0) return 0;
  return showTotals ? platformCount + 1 : platformCount;
}

type BuildDataRowsArgs = {
  effectivePeriods: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
  visiblePlatforms: string[]; // Changed from PlatformKey[] to string[] to support dynamic platforms
  months: MonthColumn[];
  bomCosts: Record<string, number>;
  showTotals: boolean;
  summaryColumns?: typeof SUMMARY_COLUMNS;
};

export function buildDataRows({
  effectivePeriods,
  forecastSummaryList,
  visiblePlatforms,
  months,
  bomCosts,
  showTotals,
  summaryColumns = SUMMARY_COLUMNS,
}: BuildDataRowsArgs) {
  if (visiblePlatforms.length === 0) {
    return [];
  }

  const rows: (string | number)[][] = [];
  const forecastMap = new Map<string, ForecastSummary>();
  forecastSummaryList.forEach((fc) => {
    forecastMap.set(fc.uploadDateLabel, fc);
  });

  effectivePeriods.forEach((salesOrders) => {
    const periodRows: (string | number)[][] = [];
    const periodForecast = forecastMap.get(salesOrders.uploadDateLabel);

    // Get platforms that actually exist in this period's data (don't show new platforms in old periods)
    const periodPlatforms = new Set<string>();
    
    // Add platforms from sales orders for this period
    Object.keys(salesOrders.totals).forEach(p => periodPlatforms.add(p));
    
    // Add platforms from forecast for this period (if exists)
    if (periodForecast) {
      Object.keys(periodForecast.totals).forEach(p => periodPlatforms.add(p));
    }
    
    // Filter visiblePlatforms to only include platforms that exist in this period
    const periodVisiblePlatforms = visiblePlatforms.filter(p => periodPlatforms.has(p));

    periodVisiblePlatforms.forEach((platform) => {
      const row: (string | number)[] = [];
      const displayUploadLabel = periodForecast?.uploadDateLabel ?? salesOrders.uploadDateLabel;
      row.push(displayUploadLabel);
      row.push(platform);

      let soSum = 0;
      let fcstSum = 0;

      const orderTotals = salesOrders.totals[platform] ?? {};
      const platformForecast = periodForecast?.totals[platform] ?? {};

      const periodMonthKeys = new Set(salesOrders.months.map((m) => m.key));
      const forecastMonthKeys = periodForecast
        ? new Set(periodForecast.months.map((m) => m.key))
        : new Set<string>();

      months.forEach((month) => {
        const isPeriodMonth = periodMonthKeys.has(month.key);
        const isForecastMonth = forecastMonthKeys.has(month.key) && isPeriodMonth;

        const bucket = isPeriodMonth ? orderTotals[month.key] : undefined;
        const soVal = isPeriodMonth ? Number(bucket?.quantity ?? 0) : 0;
        const fcstVal = isForecastMonth ? Number(platformForecast[month.key] ?? 0) : 0;
        const ssVal = 0;

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

    if (showTotals) {
      const totalsRow: (string | number)[] = [];
      totalsRow.push("");
      totalsRow.push("Total");

      for (let mi = 0; mi < months.length; mi++) {
        const soColIndex = 2 + mi * 3;
        const fcstColIndex = soColIndex + 1;
        const ssColIndex = soColIndex + 2;
        let soTotal = 0;
        let fcstTotal = 0;
        let ssTotal = 0;

        periodRows.forEach((r) => {
          soTotal += Number(r[soColIndex] || 0);
          fcstTotal += Number(r[fcstColIndex] || 0);
          ssTotal += Number(r[ssColIndex] || 0);
        });

        totalsRow.push(soTotal || "");
        totalsRow.push(fcstTotal || "");
        totalsRow.push(ssTotal || "");
      }

      const summaryStart = 2 + months.length * 3;
      for (let i = 0; i < summaryColumns.length; i++) {
        const colDef = summaryColumns[i];
        if (colDef.key === "bomCostRm") {
          totalsRow.push("");
          continue;
        }

        let sum = 0;
        periodRows.forEach((r) => {
          sum += Number(r[summaryStart + i] || 0);
        });
        totalsRow.push(sum || "");
      }

      rows.push(totalsRow);
    }
  });

  return rows;
}

// Export a helper to get platform counts per period
export function getPlatformsPerPeriod(
  effectivePeriods: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
  visiblePlatforms: string[]
): number[] {
  const forecastMap = new Map<string, ForecastSummary>();
  forecastSummaryList.forEach((fc) => {
    forecastMap.set(fc.uploadDateLabel, fc);
  });

  return effectivePeriods.map((salesOrders) => {
    const periodForecast = forecastMap.get(salesOrders.uploadDateLabel);
    const periodPlatforms = new Set<string>();
    
    Object.keys(salesOrders.totals).forEach(p => periodPlatforms.add(p));
    if (periodForecast) {
      Object.keys(periodForecast.totals).forEach(p => periodPlatforms.add(p));
    }
    
    const periodVisiblePlatforms = visiblePlatforms.filter(p => periodPlatforms.has(p));
    return periodVisiblePlatforms.length;
  });
}

export function createNestedHeaders(months: MonthColumn[]): NestedHeaders {
  const topRow: HeaderCell[] = [
    { label: "Fcast Load in Date", colspan: 1 },
    { label: "Platform", colspan: 1 },
    ...months.map((month) => ({ label: month.label, colspan: 3 })),
    { label: "Summary", colspan: SUMMARY_COLUMNS.length, className: "summary-header" },
  ];

  const secondRow: HeaderCell[] = [
    "",
    "",
    ...months.flatMap(() => ["SO", "Forecast", "SS"]),
    ...SUMMARY_COLUMNS.map((c) => ({ label: c.label, className: "summary-subheader" })),
  ];

  return [topRow, secondRow];
}

export function createColumnWidths(months: MonthColumn[]) {
  const widths: number[] = [120, 90];
  months.forEach(() => widths.push(60, 60, 60));
  return widths;
}

export function createMergeCells(periodCount: number, rowsPerPeriod: number | number[]): MergeCellSetting[] {
  if (periodCount === 0) {
    return [];
  }

  const merges: MergeCellSetting[] = [];
  let currentRow = 0;

  for (let periodIndex = 0; periodIndex < periodCount; periodIndex++) {
    const periodRows = Array.isArray(rowsPerPeriod) ? rowsPerPeriod[periodIndex] : rowsPerPeriod;
    if (periodRows <= 1) {
      currentRow += periodRows;
      continue;
    }

    merges.push({
      row: currentRow,
      col: 0,
      rowspan: periodRows,
      colspan: 1,
    });
    currentRow += periodRows;
  }

  return merges;
}

type RowMetadataArgs = {
  effectivePeriods: SalesOrderSummary[];
  rowsPerPeriod: number | number[];
  showTotals: boolean;
};

export function createRowMetadataGetter({
  effectivePeriods,
  rowsPerPeriod,
  showTotals,
}: RowMetadataArgs) {
  // Pre-calculate cumulative row counts for efficient lookup
  const cumulativeRows: number[] = [];
  let total = 0;
  const rowsArray = Array.isArray(rowsPerPeriod) ? rowsPerPeriod : Array(effectivePeriods.length).fill(rowsPerPeriod);
  
  rowsArray.forEach((count) => {
    cumulativeRows.push(total);
    total += count;
  });

  return (row: number): RowMetadata => {
    // Find which period this row belongs to
    let periodIndex = -1;
    for (let i = cumulativeRows.length - 1; i >= 0; i--) {
      if (row >= cumulativeRows[i]) {
        periodIndex = i;
        break;
      }
    }

    if (periodIndex < 0 || periodIndex >= effectivePeriods.length) {
      return { periodIndex: -1, platformIndex: -1, isTotals: false, validMonthKeys: new Set<string>() };
    }

    const period = effectivePeriods[periodIndex];
    const validMonthKeys = new Set(period.months.map((m) => m.key));
    const rowInPeriod = row - cumulativeRows[periodIndex];
    const periodRowCount = rowsArray[periodIndex];
    const isTotals = showTotals && rowInPeriod === periodRowCount - 1;

    return { periodIndex, platformIndex: isTotals ? -1 : rowInPeriod, isTotals, validMonthKeys };
  };
}

type CellCommentsArgs = {
  salesOrdersList: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
  visiblePlatforms: string[]; // Changed from PlatformKey[] to string[] to support dynamic platforms
  months: MonthColumn[];
  showTotals: boolean;
};

export function buildCellComments({
  salesOrdersList,
  forecastSummaryList,
  visiblePlatforms,
  months,
  showTotals,
}: CellCommentsArgs) {
  if (salesOrdersList.length === 0) return [];
  const comments: { row: number; col: number; comment: { value: string } }[] = [];
  
  // Calculate platforms per period (only platforms that exist in each period)
  const platformsPerPeriod = getPlatformsPerPeriod(salesOrdersList, forecastSummaryList, visiblePlatforms);
  const rowsPerPeriodArray = platformsPerPeriod.map(count => getRowsPerPeriod(showTotals, count));
  
  // Calculate cumulative row counts
  const cumulativeRows: number[] = [];
  let total = 0;
  rowsPerPeriodArray.forEach((count) => {
    cumulativeRows.push(total);
    total += count;
  });

  // Create forecast map for quick lookup
  const forecastMap = new Map<string, ForecastSummary>();
  forecastSummaryList.forEach((fc) => {
    forecastMap.set(fc.uploadDateLabel, fc);
  });

  salesOrdersList.forEach((salesOrders, periodIndex) => {
    const periodMonthKeys = new Set(salesOrders.months.map((m) => m.key));
    const periodForecast = forecastMap.get(salesOrders.uploadDateLabel);

    // Get platforms that actually exist in this period
    const periodPlatforms = new Set<string>();
    Object.keys(salesOrders.totals).forEach(p => periodPlatforms.add(p));
    if (periodForecast) {
      Object.keys(periodForecast.totals).forEach(p => periodPlatforms.add(p));
    }
    const periodVisiblePlatforms = visiblePlatforms.filter(p => periodPlatforms.has(p));

    periodVisiblePlatforms.forEach((platform, platformIndex) => {
      const rowIndex = cumulativeRows[periodIndex] + platformIndex;
      const totals = salesOrders.totals[platform] ?? {};
      const platformForecast = periodForecast?.totals[platform] ?? {};

      months.forEach((month, monthIndex) => {
        if (!periodMonthKeys.has(month.key)) return;

        const bucket = totals[month.key];
        const colIndex = 2 + monthIndex * 3;

        // Add SO comments (job numbers)
        if (bucket && bucket.jobNumbers.length > 0) {
          comments.push({
            row: rowIndex,
            col: colIndex,
            comment: {
              value: bucket.jobNumbers.join("\n"),
            },
          });
        }

        // Add Forecast comments (machine IDs = job numbers)
        // ONLY use stored machine IDs from forecast data - don't use current map for historical data
        const forecastValue = platformForecast[month.key];
        if (forecastValue && Number(forecastValue) > 0 && periodForecast?.machineIds?.[platform]?.[month.key]) {
          const machineIds = periodForecast.machineIds[platform][month.key];
          if (machineIds.length > 0) {
            const forecastColIndex = colIndex + 1; // Forecast column is next to SO column
            const machineIdList = machineIds.join("\n");
            comments.push({
              row: rowIndex,
              col: forecastColIndex,
              comment: {
                value: machineIdList,
              },
            });
          }
        }
      });
    });
  });

  return comments;
}

