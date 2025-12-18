import { PLATFORM_LABELS, PlatformKey, getBomCosts } from "./constants";
import { SalesOrderSummary } from "./salesOrders";
import { ForecastSummary } from "./forecasts";

/**
 * Discover all platforms from data and settings
 * Returns platforms sorted with defaults first, then others alphabetically
 */
export function getAllPlatforms(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
  bomCosts?: Record<string, number>
): string[] {
  const platformSet = new Set<string>();
  const resolvedBomCosts = bomCosts ?? getBomCosts();
  
  // Add platforms from default constants
  PLATFORM_LABELS.forEach(p => platformSet.add(p));
  
  // Add platforms from BOM costs (settings)
  Object.keys(resolvedBomCosts).forEach(p => platformSet.add(p));
  
  // Add platforms from sales orders data
  salesOrdersList.forEach(so => {
    Object.keys(so.totals).forEach(p => platformSet.add(p));
  });
  
  // Add platforms from forecasts data (this includes new platforms from new uploads)
  forecastSummaryList.forEach(fc => {
    Object.keys(fc.totals).forEach(p => platformSet.add(p));
  });
  
  // Sort: default platforms first, then others alphabetically
  const defaultPlatforms = PLATFORM_LABELS;
  const otherPlatforms = Array.from(platformSet).filter(p => !defaultPlatforms.includes(p as PlatformKey)).sort();
  
  return [...defaultPlatforms, ...otherPlatforms];
}

