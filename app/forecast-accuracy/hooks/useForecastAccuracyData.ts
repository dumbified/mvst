import { useMemo } from "react";
import { SalesOrderSummary } from "../../lib/data/salesOrders";
import { ForecastSummary } from "../../lib/data/forecasts";
import { calculateAllUploadChanges, UploadChanges } from "../../lib/data/forecastAccuracy";
import { parseDateLabel } from "../../lib/utils/dateUtils";
import { ChartDataPoint, UploadDateOption } from "../types";

export function useForecastAccuracyData(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
  selectedPlatform: string | "all",
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
      
      // If there's no forecast activity, check if there was a previous forecast
      // If yes, then no changes = 100% accuracy (forecast was stable/accurate)
      // If no, then we can't measure accuracy (default to 0%)
      let accuracy = 0;
      if (totalForecastActivity > 0) {
        // Calculate accuracy: (conversions / total activity) * 100
        accuracy = (sums.forecastConversions / totalForecastActivity) * 100;
      } else {
        // No forecast activity - check if there was a previous forecast
        const currentForecast = forecastSummaryList.find(
          (fc) => fc.uploadDateLabel === change.uploadDateLabel
        );
        const sortedForecasts = [...forecastSummaryList].sort((a, b) => {
          const dateA = parseDateLabel(a.uploadDateLabel)?.getTime() ?? 0;
          const dateB = parseDateLabel(b.uploadDateLabel)?.getTime() ?? 0;
          return dateA - dateB;
        });
        const currentForecastIndex = sortedForecasts.findIndex(
          (fc) => fc.uploadDateLabel === change.uploadDateLabel
        );
        const previousForecast = currentForecastIndex > 0 ? sortedForecasts[currentForecastIndex - 1] : null;
        
        // If there was a previous forecast, no changes means 100% accuracy
        if (previousForecast) {
          // Check if previous forecast had any quantity for the selected platform
          const platformsToCheck = selectedPlatform === "all" 
            ? Object.keys(previousForecast.totals)
            : [selectedPlatform];
          
          const hadPreviousForecast = platformsToCheck.some((platform) => {
            const platformTotals = previousForecast.totals[platform] ?? {};
            return Object.values(platformTotals).some((qty) => Number(qty) > 0);
          });
          
          if (hadPreviousForecast) {
            accuracy = 100; // No changes = forecast was accurate
          }
        }
      }

      // Calculate current total SO for this upload period
      // Find the SalesOrderSummary for this upload date
      const salesOrderForPeriod = salesOrdersList.find(
        (so) => so.uploadDateLabel === change.uploadDateLabel
      );

      let currentTotalSo = 0;
      if (salesOrderForPeriod) {
        // Get active months for this period
        const activeMonthKeys = new Set(salesOrderForPeriod.months.map((m) => m.key));

        // Sum quantities for all platforms (or selected platform) for active months only
        const platformsToSum =
          selectedPlatform === "all"
            ? Object.keys(salesOrderForPeriod.totals)
            : [selectedPlatform];

        platformsToSum.forEach((platform) => {
          const platformTotals = salesOrderForPeriod.totals[platform] ?? {};
          Object.entries(platformTotals).forEach(([monthKey, bucket]) => {
            // Only count active months (months in the period's month range)
            if (activeMonthKeys.has(monthKey)) {
              currentTotalSo += bucket.quantity;
            }
          });
        });
      }

      const point: ChartDataPoint = {
        uploadDate: change.uploadDateLabel,
        uploadDateShort,
        shipped: sums.shipped,
        movedToLater: sums.movedToLater,
        forecastLoadIns: sums.forecastLoadIns,
        forecastConversions: sums.forecastConversions,
        currentTotalSo,
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
  }, [uploadChanges, selectedPlatform, startUpload, endUpload, salesOrdersList]);

  return {
    uploadChanges,
    allUploadDates,
    chartData,
  };
}

