export type ChartDataPoint = {
  uploadDate: string;
  uploadDateShort: string;
  shipped: number;
  movedToLater: number;
  forecastLoadIns: number;
  forecastConversions: number;
  accuracy: number; // Forecast accuracy percentage
  currentTotalSo: number; // Current total SO for active months
  // Job lists for tooltip/title
  shippedJobs: string[];
  movedToLaterJobs: string[];
  forecastLoadInsJobs: string[];
  forecastConversionsJobs: string[];
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

