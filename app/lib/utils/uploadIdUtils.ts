import { SalesOrderSummary } from "../data/salesOrders";
import { ForecastSummary } from "../data/forecasts";

/**
 * Get the next available ID for a new upload
 * IDs start from 1 and increment for each upload
 */
export function getNextUploadId(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[]
): number {
  const allIds = new Set<number>();
  
  // Collect all existing IDs from both lists
  salesOrdersList.forEach((so) => {
    if (so.id !== undefined) {
      allIds.add(so.id);
    }
  });
  
  forecastSummaryList.forEach((fc) => {
    if (fc.id !== undefined) {
      allIds.add(fc.id);
    }
  });
  
  // Find the next available ID starting from 1
  let nextId = 1;
  while (allIds.has(nextId)) {
    nextId++;
  }
  
  return nextId;
}

/**
 * Assign IDs to uploads that don't have them (migration for existing data)
 */
export function assignMissingIds(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[]
): {
  salesOrdersList: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
} {
  const allIds = new Set<number>();
  
  // Collect existing IDs
  salesOrdersList.forEach((so) => {
    if (so.id !== undefined) {
      allIds.add(so.id);
    }
  });
  
  forecastSummaryList.forEach((fc) => {
    if (fc.id !== undefined) {
      allIds.add(fc.id);
    }
  });
  
  // Assign IDs to uploads without them
  let nextId = 1;
  const updatedSales = salesOrdersList.map((so) => {
    if (so.id === undefined) {
      while (allIds.has(nextId)) {
        nextId++;
      }
      allIds.add(nextId);
      return { ...so, id: nextId++ };
    }
    return so;
  });
  
  const updatedForecasts = forecastSummaryList.map((fc) => {
    if (fc.id === undefined) {
      while (allIds.has(nextId)) {
        nextId++;
      }
      allIds.add(nextId);
      return { ...fc, id: nextId++ };
    }
    return fc;
  });
  
  return {
    salesOrdersList: updatedSales,
    forecastSummaryList: updatedForecasts,
  };
}

