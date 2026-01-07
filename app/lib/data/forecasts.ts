import {
  formatMonthLabel,
  formatFullDate,
  monthKeyFromDate,
  parseDmyDateTime,
} from "./salesOrders";
import { MONTH_ABBREVIATIONS, PLATFORM_LABELS, getPartNumberToPlatform } from "../core/constants";
import { normalizeHeader, detectDelimiter, parseDelimitedLine } from '../utils/csvUtils';

export type ForecastSummary = {
  id?: number; // Unique ID for each upload, starting from 1
  uploadDateLabel: string;
  months: { key: string; label: string }[];
  totals: Record<string, Record<string, number>>; // Changed from PlatformKey to string to support dynamic platforms
  machineIds?: Record<string, Record<string, string[]>>; // platform -> monthKey -> machineIds[]
  /**
   * Latest "Created Date" from the forecast CSV (column J), used as Forecast load-ins date.
   * Stored as a formatted label for display in the Demand Waterfall table.
   */
  forecastLoadInsDateLabel?: string;
  /**
   * Optional map from platform + forecast month to the month key of the "Changed DT" column.
   * Used for bucketing forecast-to-SO conversions by the month when the change happened.
   * platform -> forecastMonthKey -> changedDtMonthKey
   */
  conversionMonthMap?: Record<string, Record<string, string>>;
};

const sanitizeQuantity = (value: string) => {
  const cleaned = value.replace(/,/g, "");
  const qty = Number(cleaned);
  return Number.isFinite(qty) ? qty : 0;
};

const MONTH_LOOKUP = MONTH_ABBREVIATIONS.reduce<Record<string, number>>((acc, month, index) => {
  acc[month.toLowerCase()] = index;
  return acc;
}, {});

const parseForecastDate = (value: string) => {
  const parsed = parseDmyDateTime(value);
  if (parsed) return parsed;

  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})[-\/\s](\d{2,4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const monthKey = match[2].slice(0, 3).toLowerCase();
  const month = MONTH_LOOKUP[monthKey];
  if (month === undefined) return null;

  const yearValue = Number(match[3]);
  const year = yearValue < 100 ? 2000 + yearValue : yearValue;

  return new Date(year, month, day);
};

const initializeTotals = (): Record<string, Record<string, number>> => {
  // Get all platforms from settings (part number mappings) to support new platforms
  const partNumberToPlatform = getPartNumberToPlatform();
  const platformsFromSettings = new Set<string>();
  
  // Add all platforms from the mapping
  Object.values(partNumberToPlatform).forEach(platform => {
    platformsFromSettings.add(platform);
  });
  
  // Also include default platforms
  PLATFORM_LABELS.forEach(platform => {
    platformsFromSettings.add(platform);
  });
  
  // Initialize with all known platforms
  const totals: Record<string, Record<string, number>> = {};
  platformsFromSettings.forEach(platform => {
    totals[platform] = {};
  });
  
  return totals;
};

const addMonthsToKey = (key: string, monthsToAdd: number) => {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + monthsToAdd);
  return monthKeyFromDate(date);
};

const compareMonthKeys = (a: string, b: string) => {
  if (a === b) return 0;
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (ay !== by) return ay < by ? -1 : 1;
  return am < bm ? -1 : 1;
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

export const parseForecastCsv = (
  csvText: string,
  uploadDate: Date,
  id?: number
): ForecastSummary | null => {
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

  const partIndex = normalizedHeaders.indexOf("part#");
  const dateIndex = normalizedHeaders.indexOf("forecastdate");
  const qtyIndex = normalizedHeaders.indexOf("forecastqty");
  const inactiveIndex = normalizedHeaders.indexOf("forecastinactive");
  // "Created Date" column (Forecast load-ins date source)
  const createdDateIndex = normalizedHeaders.indexOf("createddate");
  // "Changed DT" column from raw forecast CSV (e.g. "2/1/2026 09:30:38")
  const changedDtIndex = normalizedHeaders.indexOf("changeddt");

  if (partIndex === -1 || dateIndex === -1 || qtyIndex === -1) {
    console.error("[Forecast] Missing required columns:", {
      partIndex,
      dateIndex,
      qtyIndex,
      normalizedHeaders,
    });
    return null;
  }

  const totals = initializeTotals();
  const monthSet = new Set<string>();
  const uploadMonthKey = monthKeyFromDate(new Date(uploadDate.getFullYear(), uploadDate.getMonth(), 1));
  const endKey = addMonthsToKey(uploadMonthKey, 6);

  let processedCount = 0;
  let skippedCount = 0;
  const skipReasons: Record<string, number> = {};

  // Track Changed DT month per platform + forecast month
  const conversionMonthMap: Record<string, Record<string, string>> = {};
  // Track latest Created Date across all rows for this upload
  let latestCreatedDate: Date | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter);

    // Filter: only process rows where "Forecast Inactive" is False
    if (inactiveIndex !== -1) {
      const inactiveValue = (cells[inactiveIndex] ?? "").trim().toLowerCase();
      // Skip rows where Forecast Inactive is not False (could be "True", "1", "Yes", etc.)
      if (inactiveValue !== "false" && inactiveValue !== "") {
        skippedCount++;
        skipReasons["inactive"] = (skipReasons["inactive"] || 0) + 1;
        continue;
      }
    }

    const partRaw = (cells[partIndex] ?? "").trim().toLowerCase();
    const partNumberToPlatform = getPartNumberToPlatform();
    const platform = partNumberToPlatform[partRaw];
    if (!platform) {
      skippedCount++;
      skipReasons["no_platform"] = (skipReasons["no_platform"] || 0) + 1;
      continue;
    }

    const forecastDate = parseForecastDate(cells[dateIndex] ?? "");
    if (!forecastDate) {
      skippedCount++;
      skipReasons["invalid_date"] = (skipReasons["invalid_date"] || 0) + 1;
      continue;
    }

    const quantity = sanitizeQuantity(cells[qtyIndex] ?? "");
    if (!quantity) {
      skippedCount++;
      skipReasons["zero_quantity"] = (skipReasons["zero_quantity"] || 0) + 1;
      continue;
    }

    const monthKey = monthKeyFromDate(forecastDate);
    if (compareMonthKeys(monthKey, uploadMonthKey) >= 0 && compareMonthKeys(monthKey, endKey) <= 0) {
      monthSet.add(monthKey);
      // Dynamically add platform if it doesn't exist (for new platforms from settings)
      if (!totals[platform]) {
        totals[platform] = {};
      }
      totals[platform][monthKey] = (totals[platform][monthKey] ?? 0) + quantity;
      processedCount++;

      // Track latest Created Date for Forecast load-ins date label
      if (createdDateIndex !== -1) {
        const createdRaw = (cells[createdDateIndex] ?? "").trim();
        if (createdRaw) {
          const createdDate = parseDmyDateTime(createdRaw);
          if (createdDate) {
            if (!latestCreatedDate || createdDate > latestCreatedDate) {
              latestCreatedDate = createdDate;
            }
          }
        }
      }

      // Capture month of "Changed DT" (when forecast was changed / converted)
      if (changedDtIndex !== -1) {
        const changedDtRaw = (cells[changedDtIndex] ?? "").trim();
        if (changedDtRaw) {
          const changedDt = parseDmyDateTime(changedDtRaw);
          if (changedDt) {
            const changedMonthKey = monthKeyFromDate(changedDt);
            if (!conversionMonthMap[platform]) {
              conversionMonthMap[platform] = {};
            }
            const existing = conversionMonthMap[platform][monthKey];
            // Prefer the latest Changed DT month if multiple rows contribute to same forecast month
            if (!existing || compareMonthKeys(existing, changedMonthKey) < 0) {
              conversionMonthMap[platform][monthKey] = changedMonthKey;
            }
          }
        }
      }
    } else {
      skippedCount++;
      skipReasons["date_out_of_range"] = (skipReasons["date_out_of_range"] || 0) + 1;
    }
  }

  // Log processing statistics for debugging
  if (processedCount === 0 && lines.length > 1) {
    console.warn("[Forecast] No rows processed. Statistics:", {
      totalRows: lines.length - 1,
      processed: processedCount,
      skipped: skippedCount,
      skipReasons,
      uploadMonthKey,
      endKey,
    });
  }

  // Always show from the upload month through the next 6 months (inclusive)
  const rangeKeys = expandMonthRange(uploadMonthKey, endKey);
  const months = rangeKeys.map((key) => ({
    key,
    label: formatMonthLabel(key),
  }));

  return {
    ...(id !== undefined && { id }),
    uploadDateLabel: formatFullDate(uploadDate),
    months,
    totals,
    forecastLoadInsDateLabel: latestCreatedDate ? formatFullDate(latestCreatedDate) : undefined,
    conversionMonthMap: Object.keys(conversionMonthMap).length > 0 ? conversionMonthMap : undefined,
  };
};

