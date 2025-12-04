import { PlatformKey, PLATFORM_LABELS, MONTH_ABBREVIATIONS, PART_NUMBER_TO_PLATFORM } from './constants';

export type SalesOrderBucket = {
  quantity: number;
  jobNumbers: string[];
  shipped: number;
  open: number;
};

export type SalesOrderSummary = {
  uploadDateLabel: string;
  months: { key: string; label: string }[];
  totals: Record<PlatformKey, Record<string, SalesOrderBucket>>;
};

// Re-export for backward compatibility
export type { PlatformKey };
export { PLATFORM_LABELS, MONTH_ABBREVIATIONS, PART_NUMBER_TO_PLATFORM };

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
});

import { normalizeHeader, detectDelimiter, parseDelimitedLine } from './csvUtils';

export const monthKeyFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const addMonthsToKey = (key: string, monthsToAdd: number) => {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + monthsToAdd);
  return monthKeyFromDate(date);
};

const expandMonthRange = (startKey: string, endKey: string) => {
  const [startYear, startMonth] = startKey.split("-").map(Number);
  const [endYear, endMonth] = endKey.split("-").map(Number);
  const months: string[] = [];

  const current = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth - 1, 1);

  while (current <= end) {
    months.push(monthKeyFromDate(current));
    current.setMonth(current.getMonth() + 1);
  }

  return months;
};

export const formatMonthLabel = (key: string) => {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return MONTH_LABEL_FORMATTER.format(date);
};

export const formatFullDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_ABBREVIATIONS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

export const RAW_DMY_DATE_PATTERN =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

export const parseDmyDateTime = (value: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(RAW_DMY_DATE_PATTERN);
  if (match) {
    const [, dayStr, monthStr, yearStr, hourStr = "0", minuteStr = "0", secondStr = "0"] =
      match;
    const day = Number(dayStr);
    const monthIndex = Number(monthStr) - 1;
    const year = Number(yearStr);
    const hours = Number(hourStr);
    const minutes = Number(minuteStr);
    const seconds = Number(secondStr);
    const parsed = new Date(year, monthIndex, day, hours, minutes, seconds);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const sanitizeQuantity = (value: string) => {
  const cleaned = value.replace(/,/g, "");
  const qty = Number(cleaned);
  return Number.isFinite(qty) ? qty : 0;
};

const parseShipByDate = (value: string) => parseDmyDateTime(value);

const initializeTotals = (): Record<PlatformKey, Record<string, SalesOrderBucket>> =>
  PLATFORM_LABELS.reduce(
    (acc, platform) => ({
      ...acc,
      [platform]: {},
    }),
    {} as Record<PlatformKey, Record<string, SalesOrderBucket>>
  );

const getOrCreateBucket = (
  totals: Record<PlatformKey, Record<string, SalesOrderBucket>>,
  platform: PlatformKey,
  monthKey: string
) => {
  if (!totals[platform][monthKey]) {
    totals[platform][monthKey] = {
      quantity: 0,
      jobNumbers: [],
      shipped: 0,
      open: 0,
    };
  }
  return totals[platform][monthKey];
};

export const parseSalesOrdersCsv = (
  csvText: string,
  uploadDate: Date
): SalesOrderSummary | null => {
  const trimmedText = csvText.trim();
  if (!trimmedText) {
    return null;
  }

  const lines = trimmedText
    .split(/\r?\n/)
    .filter((line, index) => line.trim().length > 0 || index === 0);

  if (lines.length < 2) {
    return null;
  }

  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(headerLine);
  const headers = parseDelimitedLine(headerLine, delimiter);
  const normalizedHeaders = headers.map(normalizeHeader);

  // Try new column names first, fall back to old ones for backward compatibility
  const orderPartIndex = normalizedHeaders.indexOf("part#") !== -1 
    ? normalizedHeaders.indexOf("part#")
    : normalizedHeaders.indexOf("orderpart");
  const shipByIndex = normalizedHeaders.indexOf("relshipbydate") !== -1
    ? normalizedHeaders.indexOf("relshipbydate")
    : normalizedHeaders.indexOf("shipby");
  const orderQtyIndex = normalizedHeaders.indexOf("orderqty");
  const jobNumberIndex = normalizedHeaders.indexOf("job#") !== -1
    ? normalizedHeaders.indexOf("job#")
    : normalizedHeaders.indexOf("jobnumber");
  const statusIndex = normalizedHeaders.indexOf("status");

  if (orderPartIndex === -1 || shipByIndex === -1 || orderQtyIndex === -1) {
    return null;
  }

  const totals = initializeTotals();
  const monthSet = new Set<string>();
  const uploadMonthKey = monthKeyFromDate(new Date(uploadDate.getFullYear(), uploadDate.getMonth(), 1));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter);
    const orderPartRaw = (cells[orderPartIndex] ?? "").trim().toLowerCase();
    const platform = PART_NUMBER_TO_PLATFORM[orderPartRaw];
    if (!platform) continue;

    // Filter out void status if status column exists
    if (statusIndex !== -1) {
      const status = (cells[statusIndex] ?? "").trim().toLowerCase();
      if (status === "void") {
        continue;
      }
    }

    const shipByDate = parseShipByDate(cells[shipByIndex] ?? "");
    if (!shipByDate) continue;

    const quantity = sanitizeQuantity(cells[orderQtyIndex] ?? "");
    if (!quantity) continue;

    const monthKey = monthKeyFromDate(shipByDate);
    // Keep all data regardless of upload month - allows showing data when date is changed to previous month
    monthSet.add(monthKey);

    const bucket = getOrCreateBucket(totals, platform, monthKey);
    bucket.quantity += quantity;

    // Track status breakdown if status column exists
    if (statusIndex !== -1) {
      const status = (cells[statusIndex] ?? "").trim().toLowerCase();
      if (status === "shipped") {
        bucket.shipped += quantity;
      } else if (status === "open") {
        bucket.open += quantity;
      }
    }

    if (jobNumberIndex !== -1) {
      const jobNumber = (cells[jobNumberIndex] ?? "").trim();
      if (jobNumber && !bucket.jobNumbers.includes(jobNumber)) {
        bucket.jobNumbers.push(jobNumber);
      }
    }
  }

  // Always show from the upload month through the next 6 months (inclusive)
  const rangeStart = uploadMonthKey;
  const rangeEnd = addMonthsToKey(uploadMonthKey, 6);
  const expandedMonthKeys = expandMonthRange(rangeStart, rangeEnd);

  const months = expandedMonthKeys.map((key) => ({
    key,
    label: formatMonthLabel(key),
  }));

  return {
    uploadDateLabel: formatFullDate(uploadDate),
    months,
    totals,
  };
};

