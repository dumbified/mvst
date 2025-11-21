export type PlatformKey = "TH3K" | "TR3K" | "TRS+" | "THSE";

export type SalesOrderBucket = {
  quantity: number;
  jobNumbers: string[];
};

export type SalesOrderSummary = {
  uploadDateLabel: string;
  months: { key: string; label: string }[];
  totals: Record<PlatformKey, Record<string, SalesOrderBucket>>;
};

export const PLATFORM_LABELS: readonly PlatformKey[] = ["TH3K", "TR3K", "TRS+", "THSE"];

export const PART_NUMBER_TO_PLATFORM: Record<string, PlatformKey> = {
  "9300-ai001": "TH3K",
  "9301-ai001": "TH3K",
  "9300-ai002": "TR3K",
  "9301-ai002": "TR3K",
  "9300-i013": "TRS+",
  "9301-i013": "TRS+",
  "9300-i012": "THSE",
  "9300-i011": "TR3K",
  "9300-i010": "TH3K",
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
});

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const normalizeHeader = (header: string) =>
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

export const monthKeyFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const addMonthsToKey = (key: string, monthsToAdd: number) => {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + monthsToAdd);
  return monthKeyFromDate(date);
};

const compareMonthKeys = (a: string, b: string) => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
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

export const formatFullDate = (date: Date) => FULL_DATE_FORMATTER.format(date);

const sanitizeQuantity = (value: string) => {
  const cleaned = value.replace(/,/g, "");
  const qty = Number(cleaned);
  return Number.isFinite(qty) ? qty : 0;
};

const parseShipByDate = (value: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

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

  const orderPartIndex = normalizedHeaders.indexOf("orderpart");
  const shipByIndex = normalizedHeaders.indexOf("shipby");
  const orderQtyIndex = normalizedHeaders.indexOf("orderqty");
  const jobNumberIndex = normalizedHeaders.indexOf("jobnumber");

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

    const shipByDate = parseShipByDate(cells[shipByIndex] ?? "");
    if (!shipByDate) continue;

    const quantity = sanitizeQuantity(cells[orderQtyIndex] ?? "");
    if (!quantity) continue;

    const monthKey = monthKeyFromDate(shipByDate);
    if (compareMonthKeys(monthKey, uploadMonthKey) < 0) {
      continue;
    }
    monthSet.add(monthKey);

    const bucket = getOrCreateBucket(totals, platform, monthKey);
    bucket.quantity += quantity;

    if (jobNumberIndex !== -1) {
      const jobNumber = (cells[jobNumberIndex] ?? "").trim();
      if (jobNumber && !bucket.jobNumbers.includes(jobNumber)) {
        bucket.jobNumbers.push(jobNumber);
      }
    }
  }

  const sortedMonthKeys = Array.from(monthSet).sort();
  const rangeStart =
    sortedMonthKeys.length > 0 && compareMonthKeys(sortedMonthKeys[0], uploadMonthKey) >= 0
      ? sortedMonthKeys[0]
      : uploadMonthKey;
  const furthestDataMonth =
    sortedMonthKeys.length > 0 ? sortedMonthKeys[sortedMonthKeys.length - 1] : uploadMonthKey;
  const minSixMonthEnd = addMonthsToKey(uploadMonthKey, 6); // includes upload month + 5 = 6 months total
  const rangeEnd =
    compareMonthKeys(furthestDataMonth, minSixMonthEnd) >= 0 ? furthestDataMonth : minSixMonthEnd;

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

