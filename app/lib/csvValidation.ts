/**
 * Detects the type of CSV file based on its headers
 * Returns 'salesOrders', 'forecast', or 'unknown'
 */
export type CsvFileType = 'salesOrders' | 'forecast' | 'unknown';

const normalizeHeader = (header: string) =>
  header.replace(/\s+/g, '').replace(/\./g, '').toLowerCase();

const detectDelimiter = (line: string) => {
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
};

const parseDelimitedLine = (line: string, delimiter: string) => {
  const values: string[] = [];
  let current = '';
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
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.replace(/\r$/, ''));
};

/**
 * Detects the CSV file type by examining the headers
 */
export async function detectCsvFileType(file: File): Promise<CsvFileType> {
  try {
    const text = await file.text();
    const trimmedText = text.trim();
    if (!trimmedText) {
      return 'unknown';
    }

    const lines = trimmedText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 1) {
      return 'unknown';
    }

    const headerLine = lines[0].replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(headerLine);
    const headers = parseDelimitedLine(headerLine, delimiter);
    const normalizedHeaders = headers.map(normalizeHeader);

    // Sales Orders CSV should have: orderpart, shipby, orderqty
    const hasOrderPart = normalizedHeaders.includes('orderpart');
    const hasShipBy = normalizedHeaders.includes('shipby');
    const hasOrderQty = normalizedHeaders.includes('orderqty');

    // Forecast CSV should have: part#, forecastdate, forecastqty
    const hasPart = normalizedHeaders.includes('part#');
    const hasForecastDate = normalizedHeaders.includes('forecastdate');
    const hasForecastQty = normalizedHeaders.includes('forecastqty');

    const isSalesOrders = hasOrderPart && hasShipBy && hasOrderQty;
    const isForecast = hasPart && hasForecastDate && hasForecastQty;

    if (isSalesOrders && !isForecast) {
      return 'salesOrders';
    }
    if (isForecast && !isSalesOrders) {
      return 'forecast';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

