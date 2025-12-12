import { useMemo } from "react";
import { SalesOrderSummary } from "../../lib/salesOrders";
import { ForecastSummary } from "../../lib/forecasts";
import { calculateAllUploadChanges, UploadChanges } from "../../lib/forecastAccuracy";
import { parseDateLabel } from "../../lib/dateUtils";
import { PlatformKey } from "../../lib/constants";
import { ChartDataPoint, UploadDateOption } from "../types";

export function useForecastAccuracyData(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
  selectedPlatform: PlatformKey | "all",
  startUpload: string | "all",
  endUpload: string | "all",
) {
  const uploadChanges = useMemo(() => {
    return calculateAllUploadChanges(salesOrdersList, forecastSummaryList);
  }, [salesOrdersList, forecastSummaryList]);

  const allUploadDates = useMemo<UploadDateOption[]>(
    () =>
      uploadChanges.map((c) => ({
        label: c.uploadDateLabel,
        time: parseDateLabel(c.uploadDateLabel)?.getTime() ?? 0,
      })),
    [uploadChanges],
  );

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (uploadChanges.length === 0) return [];

    const collectJobs = (changes: UploadChanges["changes"], type: string) =>
      changes
        .filter((c) => c.type === type && c.jobNumbers && c.jobNumbers.length > 0)
        .flatMap((c) => c.jobNumbers as string[]);

    const data: ChartDataPoint[] = uploadChanges.map((change) => {
      const scopedChanges =
        selectedPlatform === "all"
          ? change.changes
          : change.changes.filter((c) => c.platform === selectedPlatform);

      const uploadDate = parseDateLabel(change.uploadDateLabel);
      const uploadDateShort = uploadDate
        ? `${uploadDate.getDate()}/${uploadDate.getMonth() + 1}/${uploadDate.getFullYear().toString().slice(-2)}`
        : change.uploadDateLabel;

      // Calculate quantities based on scope
      const sums = {
        shipped: scopedChanges.filter((c) => c.type === "shipped").reduce((sum, c) => sum + c.quantity, 0),
        movedToLater: scopedChanges.filter((c) => c.type === "moved_to_later_month").reduce((sum, c) => sum + c.quantity, 0),
        forecastLoadIns: scopedChanges.filter((c) => c.type === "forecast_load_in").reduce((sum, c) => sum + c.quantity, 0),
        forecastConversions: scopedChanges.filter((c) => c.type === "forecast_to_so_conversion").reduce((sum, c) => sum + c.quantity, 0),
      };

      // Calculate accuracy from scoped values
      const totalForecastActivity = sums.forecastConversions + sums.forecastLoadIns;
      const accuracy = totalForecastActivity > 0
        ? (sums.forecastConversions / totalForecastActivity) * 100
        : 0;

      const point: ChartDataPoint = {
        uploadDate: change.uploadDateLabel,
        uploadDateShort,
        shipped: sums.shipped,
        movedToLater: sums.movedToLater,
        forecastLoadIns: sums.forecastLoadIns,
        forecastConversions: sums.forecastConversions,
        shippedJobs: collectJobs(scopedChanges, "shipped"),
        movedToLaterJobs: collectJobs(scopedChanges, "moved_to_later_month"),
        forecastLoadInsJobs: collectJobs(scopedChanges, "forecast_load_in"),
        forecastConversionsJobs: collectJobs(scopedChanges, "forecast_to_so_conversion"),
        accuracy: Math.round(accuracy * 10) / 10, // Round to 1 decimal
      };

      return point;
    });

    // Filter by upload date range if set
    const startTime =
      startUpload === "all" ? Number.NEGATIVE_INFINITY : parseDateLabel(startUpload)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const endTime =
      endUpload === "all" ? Number.POSITIVE_INFINITY : parseDateLabel(endUpload)?.getTime() ?? Number.POSITIVE_INFINITY;

    return data.filter((d) => {
      const t = parseDateLabel(d.uploadDate)?.getTime() ?? 0;
      return t >= startTime && t <= endTime;
    });
  }, [uploadChanges, selectedPlatform, startUpload, endUpload]);

  return {
    uploadChanges,
    allUploadDates,
    chartData,
  };
}

