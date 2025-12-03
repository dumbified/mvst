/**
 * Detects the type of CSV file based on its headers
 * Returns 'salesOrders', 'forecast', or 'unknown'
 */
import { normalizeHeader, detectDelimiter, parseDelimitedLine } from './csvUtils';

export type CsvFileType = 'salesOrders' | 'forecast' | 'unknown';

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

