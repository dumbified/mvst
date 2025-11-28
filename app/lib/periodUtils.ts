import { SalesOrderSummary, formatFullDate } from "./salesOrders";
import { ForecastSummary } from "./forecasts";
import { buildMonthsWindow } from "./dateUtils";

export function updatePeriodDates(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
  oldDateLabel: string,
  newDate: Date,
): {
  salesOrders: SalesOrderSummary[];
  forecasts: ForecastSummary[];
} {
  const months = buildMonthsWindow(newDate);
  const newDateLabel = formatFullDate(newDate);

  const updatedForecasts = forecastSummaryList.map((fc) =>
    fc.uploadDateLabel === oldDateLabel
      ? {
          ...fc,
          uploadDateLabel: newDateLabel,
          months,
        }
      : fc,
  );

  const updatedSales = salesOrdersList.map((so) =>
    so.uploadDateLabel === oldDateLabel
      ? {
          ...so,
          uploadDateLabel: newDateLabel,
          months,
        }
      : so,
  );

  return {
    salesOrders: updatedSales,
    forecasts: updatedForecasts,
  };
}

