import { PlatformKey, PLATFORM_LABELS, MONTH_ABBREVIATIONS, PART_NUMBER_TO_PLATFORM, getPartNumberToPlatform } from '../core/constants';

export type SalesOrderBucket = {
  quantity: number;
  jobNumbers: string[];
  shipped: number;
  open: number;
  // Track per-job status so we can detect shipped jobs even if they drop out next month
  jobStatus?: Record<string, "shipped" | "open" | "void" | "other">;
};

export type SalesOrderSummary = {
  uploadDateLabel: string;
  months: { key: string; label: string }[];
  totals: Record<string, Record<string, SalesOrderBucket>>; // Changed from PlatformKey to string to support dynamic platforms
};

// Re-export for backward compatibility
export type { PlatformKey };
export { PLATFORM_LABELS, MONTH_ABBREVIATIONS, PART_NUMBER_TO_PLATFORM };

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
});

import { normalizeHeader, detectDelimiter, parseDelimitedLine } from '../utils/csvUtils';

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
      jobStatus: {},
    };
  }
  return totals[platform][monthKey];
};

export const parseSalesOrdersCsv = (
  csvText: string,
  uploadDate: Date
): SalesOrderSummary | null => {
  // Drop very old data up front (keep from Jan 2025) and only keep recent horizon (6 months before upload)
  const minDate = new Date(2025, 0, 1);
  const sixMonthsAgo = new Date(uploadDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const effectiveMinDate = sixMonthsAgo > minDate ? sixMonthsAgo : minDate;

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
    console.error("[Sales Orders] Missing required columns:", {
      orderPartIndex,
      shipByIndex,
      orderQtyIndex,
      normalizedHeaders,
    });
    return null;
  }

  const totals = initializeTotals();
  const monthSet = new Set<string>();
  const uploadMonthKey = monthKeyFromDate(new Date(uploadDate.getFullYear(), uploadDate.getMonth(), 1));

  const partNumberToPlatform = getPartNumberToPlatform();
  let processedCount = 0;
  let skippedCount = 0;
  const skipReasons: Record<string, number> = {};
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter);
    const orderPartRaw = (cells[orderPartIndex] ?? "").trim().toLowerCase();
    const platform = partNumberToPlatform[orderPartRaw];
    if (!platform) {
      skippedCount++;
      skipReasons["no_platform"] = (skipReasons["no_platform"] || 0) + 1;
      continue;
    }

    // Filter out void status if status column exists
    const rawStatus = statusIndex !== -1 ? (cells[statusIndex] ?? "").trim().toLowerCase() : "";
    if (rawStatus === "void") {
      skippedCount++;
      skipReasons["void_status"] = (skipReasons["void_status"] || 0) + 1;
      continue;
    }

    const shipByDate = parseShipByDate(cells[shipByIndex] ?? "");
    if (!shipByDate) {
      skippedCount++;
      skipReasons["invalid_date"] = (skipReasons["invalid_date"] || 0) + 1;
      continue;
    }

    // Skip records earlier than the effective cutoff to keep dataset small and relevant
    if (shipByDate < effectiveMinDate) {
      skippedCount++;
      skipReasons["date_too_old"] = (skipReasons["date_too_old"] || 0) + 1;
      continue;
    }

    const quantity = sanitizeQuantity(cells[orderQtyIndex] ?? "");
    if (!quantity) {
      skippedCount++;
      skipReasons["zero_quantity"] = (skipReasons["zero_quantity"] || 0) + 1;
      continue;
    }
    
    processedCount++;

    const monthKey = monthKeyFromDate(shipByDate);
    // Keep all data regardless of upload month - allows showing data when date is changed to previous month
    monthSet.add(monthKey);

    const bucket = getOrCreateBucket(totals, platform, monthKey);

    // Only count open backlog in quantity. Shipped rows should not contribute to SO backlog.
    if (rawStatus === "shipped") {
        bucket.shipped += quantity;
    } else {
      bucket.quantity += quantity;
      if (rawStatus === "open" || rawStatus === "") {
        bucket.open += quantity;
      }
    }

    if (jobNumberIndex !== -1) {
      const jobNumber = (cells[jobNumberIndex] ?? "").trim();
      if (jobNumber) {
        const normalizedStatus =
          rawStatus === "shipped"
            ? "shipped"
            : rawStatus === "open"
              ? "open"
              : rawStatus === "void"
                ? "void"
                : "other";
        if (!bucket.jobStatus) bucket.jobStatus = {};
        bucket.jobStatus[jobNumber] = normalizedStatus;
        
        // Only add job number to jobNumbers array if it's NOT shipped
        // Shipped jobs should NOT appear in comments/demand waterfall
        if (normalizedStatus !== "shipped") {
          if (!bucket.jobNumbers.includes(jobNumber)) {
            bucket.jobNumbers.push(jobNumber);
          }
        } else {
          // If job is shipped, remove it from jobNumbers if it was previously added
          // (handles case where same job appears in multiple uploads with different statuses)
          const jobIndex = bucket.jobNumbers.indexOf(jobNumber);
          if (jobIndex !== -1) {
            bucket.jobNumbers.splice(jobIndex, 1);
          }
        }
      }
    }
  }

  // Log processing statistics for debugging
  if (processedCount === 0 && lines.length > 1) {
    console.warn("[Sales Orders] No rows processed. Statistics:", {
      totalRows: lines.length - 1,
      processed: processedCount,
      skipped: skippedCount,
      skipReasons,
      effectiveMinDate: effectiveMinDate.toISOString(),
      uploadDate: uploadDate.toISOString(),
    });
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

