import {
  PLATFORM_LABELS,
  formatMonthLabel,
  formatFullDate,
  monthKeyFromDate,
  PART_NUMBER_TO_PLATFORM,
  PlatformKey,
} from "./salesOrders";

export type ForecastSummary = {
  uploadDateLabel: string;
  months: { key: string; label: string }[];
  totals: Record<PlatformKey, Record<string, number>>;
};

const NORMALIZE_HEADER = (header: string) =>
  header.replace(/\s+/g, "").replace(/\./g, "").toLowerCase();

const detectDelimiter = (line: string) => {
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
};

const parseDelimitedLine = (line: string, delimiter: string) => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.replace(/\r$/, ""));
};

const sanitizeQuantity = (value: string) => {
  const cleaned = value.replace(/,/g, "");
  const qty = Number(cleaned);
  return Number.isFinite(qty) ? qty : 0;
};

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const parseForecastDate = (value: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const match = trimmed.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})[-\/\s](\d{2,4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTH_INDEX[match[2].toLowerCase()];
  if (month === undefined) return null;

  const yearValue = Number(match[3]);
  const year = yearValue < 100 ? 2000 + yearValue : yearValue;

  return new Date(year, month, day);
};

const initializeTotals = (): Record<PlatformKey, Record<string, number>> => {
  return PLATFORM_LABELS.reduce(
    (acc, platform) => ({
      ...acc,
      [platform]: {},
    }),
    {} as Record<PlatformKey, Record<string, number>>,
  );
};

export const parseForecastCsv = (
  csvText: string,
  uploadDate: Date,
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
  const normalizedHeaders = headers.map(NORMALIZE_HEADER);

  const partIndex = normalizedHeaders.indexOf("part#");
  const dateIndex = normalizedHeaders.indexOf("forecastdate");
  const qtyIndex = normalizedHeaders.indexOf("forecastqty");

  if (partIndex === -1 || dateIndex === -1 || qtyIndex === -1) {
    return null;
  }

  const totals = initializeTotals();
  const monthSet = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter);

    const partRaw = (cells[partIndex] ?? "").trim().toLowerCase();
    const platform = PART_NUMBER_TO_PLATFORM[partRaw];
    if (!platform) continue;

    const forecastDate = parseForecastDate(cells[dateIndex] ?? "");
    if (!forecastDate) continue;

    const quantity = sanitizeQuantity(cells[qtyIndex] ?? "");
    if (!quantity) continue;

    const monthKey = monthKeyFromDate(forecastDate);
    monthSet.add(monthKey);
    totals[platform][monthKey] = (totals[platform][monthKey] ?? 0) + quantity;
  }

  if (monthSet.size === 0) {
    return null;
  }

  const sortedKeys = Array.from(monthSet).sort();
  const months = sortedKeys.map((key) => ({
    key,
    label: formatMonthLabel(key),
  }));

  return {
    uploadDateLabel: formatFullDate(uploadDate),
    months,
    totals,
  };
};

