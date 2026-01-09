export type ForecastVariance = {
  positive: number;
  negative: number;
  positiveJobs: string[];
  negativeJobs: string[];
};

export type ChartDataPoint = {
  uploadDate: string;
  uploadDateShort: string;
  shipped: number;
  movedToLater: number;
  forecastLoadIns: number;
  forecastConversions: number;
  cancelledForecast: number;
  shippedDemo: number;
  accuracy: number; // Forecast accuracy percentage (calculated by month)
  currentTotalSo: number; // Current total SO for active months
  forecastVariance: ForecastVariance;
  // Job lists for tooltip/title
  shippedJobs: string[];
  movedToLaterJobs: string[];
  forecastLoadInsJobs: string[];
  forecastConversionsJobs: string[];
  cancelledForecastJobs: string[];
  shippedDemoJobs: string[];
  [key: string]: string | number | string[] | ForecastVariance; // For platform-specific data
};

export type ChartType = "combined" | "accuracy";

export type VisibleSeries = {
  forecastLoadIns: boolean;
  forecastConversions: boolean;
  shipped: boolean;
  movedToLater: boolean;
  currentTotalSo: boolean;
};

export type UploadDateOption = {
  label: string;
  time: number;
};

export type MonthOption = {
  label: string;
  key: string;
  time: number;
};

export type MonthlyAccuracyData = {
  forecastMonthKey: string; // e.g., "2025-11" (forecast month bucket)
  forecastMonthLabel: string; // e.g., "Nov 25"
  maxForecastQuantity: number; // Maximum forecast quantity across all forecast uploads for this month
  actualShippedQuantity: number; // Actual shipped quantity for this month
  forecastAccuracy: number; // Forecast accuracy: (actual shipped / max forecast) * 100
  hasShippedData: boolean; // Whether there is actual shipped data for this month
  shippedJobs?: string[]; // List of shipped job numbers contributing to actualShippedQuantity
  sixMonthRollingAccuracy?: number; // 6-month rolling accuracy: (current month actual shipped / max forecast in 6 months) * 100
  maxForecastInSixMonths?: number; // Maximum forecast quantity across the 6 months before (including current month)
};

export type MonthlySummaryData = {
  uploadMonthKey: string; // e.g., "2025-11" (month when uploads happened)
  uploadMonthLabel: string; // e.g., "Nov 25"
  totalShipped: number; // Sum of all shipped across all uploads in this month
  totalNewForecast: number; // Sum of all forecast_load_in across all uploads in this month
  totalFcastToSo: number; // Sum of all forecast_to_so_conversion across all uploads in this month
  shippedJobs: string[]; // Job numbers for shipped items
  forecastLoadInsJobs: string[]; // Job numbers for new forecast items
  forecastConversionsJobs: string[]; // Job numbers for forecast to SO conversions
};

