import {
  PLATFORM_LABELS,
  PlatformKey,
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
    return forecastSummaryList.map((fc) => ({
      uploadDateLabel: fc.uploadDateLabel,
      months: fc.months,
      totals: PLATFORM_LABELS.reduce(
        (acc, platform) => ({
          ...acc,
          [platform]: {},
        }),
        {} as Record<PlatformKey, Record<string, SalesOrderBucket>>,
      ),
    }));
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
  visiblePlatforms: PlatformKey[];
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

    visiblePlatforms.forEach((platform) => {
      const row: (string | number)[] = [];
      row.push(salesOrders.uploadDateLabel);
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

export function createNestedHeaders(months: MonthColumn[]) {
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
}

export function createColumnWidths(months: MonthColumn[]) {
  const widths: number[] = [120, 90];
  months.forEach(() => widths.push(60, 60, 60));
  return widths;
}

export function createMergeCells(periodCount: number, rowsPerPeriod: number) {
  if (rowsPerPeriod <= 1 || periodCount === 0) {
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
}

type TotalsCellMetaArgs = {
  periodCount: number;
  rowsPerPeriod: number;
  monthsLength: number;
  summaryColumnsLength: number;
  showTotals: boolean;
};

export function createTotalsCellMeta({
  periodCount,
  rowsPerPeriod,
  monthsLength,
  summaryColumnsLength,
  showTotals,
}: TotalsCellMetaArgs) {
  if (!showTotals || rowsPerPeriod === 0 || periodCount === 0) return [];
  const totalCols = 2 + monthsLength * 3 + summaryColumnsLength;
  const cells: any[] = [];

  for (let periodIndex = 0; periodIndex < periodCount; periodIndex++) {
    const totalsRowIndex = periodIndex * rowsPerPeriod + (rowsPerPeriod - 1);
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
}

type SummaryCellMetaArgs = {
  periodCount: number;
  rowsPerPeriod: number;
  monthsLength: number;
};

export function createSummaryCellMeta({
  periodCount,
  rowsPerPeriod,
  monthsLength,
}: SummaryCellMetaArgs) {
  if (rowsPerPeriod === 0 || periodCount === 0) return [];
  const meta: any[] = [];
  const summaryStart = 2 + monthsLength * 3;
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
}

type RowMetadataArgs = {
  effectivePeriods: SalesOrderSummary[];
  rowsPerPeriod: number;
  showTotals: boolean;
};

export function createRowMetadataGetter({
  effectivePeriods,
  rowsPerPeriod,
  showTotals,
}: RowMetadataArgs) {
  return (row: number): RowMetadata => {
    if (rowsPerPeriod === 0) {
      return { periodIndex: -1, platformIndex: -1, isTotals: false, validMonthKeys: new Set<string>() };
    }

    const periodIndex = Math.floor(row / rowsPerPeriod);
    const rowInPeriod = rowsPerPeriod === 0 ? 0 : row % rowsPerPeriod;
    const isTotals = showTotals && rowInPeriod === rowsPerPeriod - 1;
    const platformIndex = isTotals ? -1 : rowInPeriod;

    if (periodIndex >= effectivePeriods.length) {
      return { periodIndex: -1, platformIndex: -1, isTotals: false, validMonthKeys: new Set<string>() };
    }

    const period = effectivePeriods[periodIndex];
    const validMonthKeys = new Set(period.months.map((m) => m.key));

    return { periodIndex, platformIndex, isTotals, validMonthKeys };
  };
}

type CellCommentsArgs = {
  salesOrdersList: SalesOrderSummary[];
  visiblePlatforms: PlatformKey[];
  months: MonthColumn[];
  showTotals: boolean;
};

export function buildCellComments({
  salesOrdersList,
  visiblePlatforms,
  months,
  showTotals,
}: CellCommentsArgs) {
  if (salesOrdersList.length === 0) return [];
  const comments: { row: number; col: number; comment: { value: string } }[] = [];
  const rowsPerPeriod = getRowsPerPeriod(showTotals, visiblePlatforms.length);

  salesOrdersList.forEach((salesOrders, periodIndex) => {
    const periodMonthKeys = new Set(salesOrders.months.map((m) => m.key));

    visiblePlatforms.forEach((platform, platformIndex) => {
      const rowIndex = rowsPerPeriod === 0 ? 0 : periodIndex * rowsPerPeriod + platformIndex;
      const totals = salesOrders.totals[platform] ?? {};
      months.forEach((month, monthIndex) => {
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
}

