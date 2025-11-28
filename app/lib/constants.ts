export const DEFAULT_BOM_COSTS: Record<string, number> = {
  TH3K: 583382,
  TR3K: 834063,
  THSE: 306667,
  "TRS+": 390193,
};

export const STORAGE_KEYS = {
  SALES_ORDERS: "mvst_salesOrdersList",
  FORECASTS: "mvst_forecastSummary",
  BOM_COSTS: "mvst_bom_costs",
} as const;

