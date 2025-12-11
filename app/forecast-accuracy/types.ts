import { UploadChanges } from "../lib/forecastAccuracy";
import { PlatformKey } from "../lib/constants";

export type ChartDataPoint = {
  uploadDate: string;
  uploadDateShort: string;
  newOrders: number;
  shipped: number;
  movedToLater: number;
  forecastLoadIns: number;
  accuracy: number; // Forecast accuracy percentage
  // Job lists for tooltip/title
  newOrdersJobs: string[];
  shippedJobs: string[];
  movedToLaterJobs: string[];
  [key: string]: string | number | string[]; // For platform-specific data
};

export type ChartType = "combined" | "accuracy";

export type VisibleSeries = {
  forecastLoadIns: boolean;
  newOrders: boolean;
  shipped: boolean;
  movedToLater: boolean;
};

export type ForecastAccuracyFilters = {
  selectedPlatform: PlatformKey | "all";
  chartType: ChartType;
  visibleSeries: VisibleSeries;
  startUpload: string | "all";
  endUpload: string | "all";
};

export type UploadDateOption = {
  label: string;
  time: number;
};

