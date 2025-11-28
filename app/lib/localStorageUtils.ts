import { STORAGE_KEYS } from "./constants";
import { SalesOrderSummary } from "./salesOrders";
import { ForecastSummary } from "./forecasts";

export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed = JSON.parse(item);
    return parsed ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

export function loadSalesOrdersFromLocalStorage(): SalesOrderSummary[] {
  const parsed = loadFromLocalStorage<SalesOrderSummary[]>(STORAGE_KEYS.SALES_ORDERS, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function loadForecastsFromLocalStorage(): ForecastSummary[] {
  const parsed = loadFromLocalStorage<ForecastSummary[] | ForecastSummary>(
    STORAGE_KEYS.FORECASTS,
    [],
  );
  if (Array.isArray(parsed)) {
    return parsed;
  }
  // Support legacy format (single object)
  if (parsed && typeof parsed === "object" && "uploadDateLabel" in parsed) {
    return [parsed as ForecastSummary];
  }
  return [];
}

export function loadBomCostsFromLocalStorage(defaultCosts: Record<string, number>): Record<string, number> {
  const parsed = loadFromLocalStorage<Record<string, number>>(STORAGE_KEYS.BOM_COSTS, {});
  if (parsed && typeof parsed === "object") {
    return { ...defaultCosts, ...parsed };
  }
  return defaultCosts;
}

export function saveSalesOrdersToLocalStorage(salesOrders: SalesOrderSummary[]): void {
  saveToLocalStorage(STORAGE_KEYS.SALES_ORDERS, salesOrders);
}

export function saveForecastsToLocalStorage(forecasts: ForecastSummary[]): void {
  saveToLocalStorage(STORAGE_KEYS.FORECASTS, forecasts);
}

export function saveBomCostsToLocalStorage(costs: Record<string, number>): void {
  saveToLocalStorage(STORAGE_KEYS.BOM_COSTS, costs);
}

