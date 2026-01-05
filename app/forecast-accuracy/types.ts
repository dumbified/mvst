export type ChartDataPoint = {
  uploadDate: string;
  uploadDateShort: string;
  shipped: number;
  movedToLater: number;
  forecastLoadIns: number;
  forecastConversions: number;
  cancelledForecast: number;
  accuracy: number; // Forecast accuracy percentage (calculated by month)
  currentTotalSo: number; // Current total SO for active months
  // Job lists for tooltip/title
  shippedJobs: string[];
  movedToLaterJobs: string[];
  forecastLoadInsJobs: string[];
  forecastConversionsJobs: string[];
  cancelledForecastJobs: string[];
  [key: string]: string | number | string[]; // For platform-specific data
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
  uploadMonthKey: string; // e.g., "2025-11" (month when uploads happened)
  uploadMonthLabel: string; // e.g., "Nov 25"
  totalNewForecast: number; // Sum of all forecast_load_in across all forecast months (quantity)
  totalFcastToSo: number; // Sum of all forecast_to_so_conversion across all forecast months (quantity)
  totalShipped: number; // Sum of all shipped across all uploads in this month
  forecastAccuracy: number; // Job-based forecast accuracy: (unique converted jobs) / (unique forecast jobs) * 100
  uniqueForecastJobs: number; // Count of unique forecast job numbers
  uniqueConvertedJobs: number; // Count of unique forecast jobs that converted to SO
  uploadCount: number; // Number of uploads in this month
  // Job lists for tooltip
  forecastLoadInsJobs: string[];
  forecastConversionsJobs: string[];
  shippedJobs: string[];
};

