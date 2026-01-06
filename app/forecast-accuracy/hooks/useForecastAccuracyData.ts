import { useMemo } from "react";
import { SalesOrderSummary, formatMonthLabel, monthKeyFromDate } from "../../lib/data/salesOrders";
import { ForecastSummary } from "../../lib/data/forecasts";
import { calculateAllUploadChanges, UploadChanges } from "../../lib/data/forecastAccuracy";
import { parseDateLabel, monthKeyToTimestamp } from "../../lib/utils/dateUtils";
import { ChartDataPoint, MonthlyAccuracyData, MonthlySummaryData } from "../types";

export function useForecastAccuracyData(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
  selectedPlatform: string,
  startMonth: string | "all",
  endMonth: string | "all",
) {
  const uploadChanges = useMemo(() => {
    return calculateAllUploadChanges(salesOrdersList, forecastSummaryList);
  }, [salesOrdersList, forecastSummaryList]);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (uploadChanges.length === 0) return [];

    const collectJobs = (changes: UploadChanges["changes"], type: string) =>
      changes
        .filter((c) => c.type === type && c.jobNumbers && c.jobNumbers.length > 0)
        .flatMap((c) => c.jobNumbers as string[]);

    // Calculate data points per upload (without accuracy - that's now in monthlyAccuracyData)
    const data: ChartDataPoint[] = uploadChanges.map((change) => {
      const scopedChanges = change.changes.filter((c) => c.platform === selectedPlatform);

      const uploadDate = parseDateLabel(change.uploadDateLabel);
      const uploadDateShort = uploadDate
        ? `${uploadDate.getDate()}/${uploadDate.getMonth() + 1}/${uploadDate.getFullYear().toString().slice(-2)}`
        : change.uploadDateLabel;

      // Calculate quantities based on scope (per upload)
      const sums = {
        shipped: scopedChanges.filter((c) => c.type === "shipped").reduce((sum, c) => sum + c.quantity, 0),
        movedToLater: scopedChanges.filter((c) => c.type === "moved_to_later_month").reduce((sum, c) => sum + c.quantity, 0),
        forecastLoadIns: scopedChanges.filter((c) => c.type === "forecast_load_in").reduce((sum, c) => sum + c.quantity, 0),
        forecastConversions: scopedChanges.filter((c) => c.type === "forecast_to_so_conversion").reduce((sum, c) => sum + c.quantity, 0),
        cancelledForecast: scopedChanges.filter((c) => c.type === "cancelled_forecast").reduce((sum, c) => sum + c.quantity, 0),
      };

      // Calculate current total SO for this upload period
      const salesOrderForPeriod = salesOrdersList.find(
        (so) => so.uploadDateLabel === change.uploadDateLabel
      );

      let currentTotalSo = 0;
      if (salesOrderForPeriod) {
        const activeMonthKeys = new Set(salesOrderForPeriod.months.map((m) => m.key));
        const platformTotals = salesOrderForPeriod.totals[selectedPlatform] ?? {};
        Object.entries(platformTotals).forEach(([monthKey, bucket]) => {
          if (activeMonthKeys.has(monthKey)) {
            currentTotalSo += bucket.quantity;
          }
        });
      }

      // Filter forecast variance by platform
      let filteredForecastVariance = change.summary.forecastVariance;
      // Find the current forecast for this upload to get platform info for machine IDs
      const currentForecast = forecastSummaryList.find(
        (fc) => fc.uploadDateLabel === change.uploadDateLabel
      );

      if (currentForecast && currentForecast.machineIds) {
        // Build a map of machine ID -> platform
        const machineIdToPlatform = new Map<string, string>();
        Object.entries(currentForecast.machineIds).forEach(([platform, monthMachineIds]) => {
          Object.values(monthMachineIds).forEach((machineIds) => {
            machineIds.forEach((machineId) => {
              machineIdToPlatform.set(machineId, platform);
            });
          });
        });

        // Filter positive and negative jobs by platform
        const filteredPositiveJobs = change.summary.forecastVariance.positiveJobs.filter(
          (machineId) => machineIdToPlatform.get(machineId) === selectedPlatform
        );
        const filteredNegativeJobs = change.summary.forecastVariance.negativeJobs.filter(
          (machineId) => machineIdToPlatform.get(machineId) === selectedPlatform
        );

        filteredForecastVariance = {
          positive: filteredPositiveJobs.length,
          negative: filteredNegativeJobs.length,
          positiveJobs: filteredPositiveJobs,
          negativeJobs: filteredNegativeJobs,
        };
      }

      const point: ChartDataPoint = {
        uploadDate: change.uploadDateLabel,
        uploadDateShort,
        shipped: sums.shipped,
        movedToLater: sums.movedToLater,
        forecastLoadIns: sums.forecastLoadIns,
        forecastConversions: sums.forecastConversions,
        cancelledForecast: sums.cancelledForecast,
        forecastVariance: filteredForecastVariance,
        currentTotalSo,
        shippedJobs: collectJobs(scopedChanges, "shipped"),
        movedToLaterJobs: collectJobs(scopedChanges, "moved_to_later_month"),
        forecastLoadInsJobs: collectJobs(scopedChanges, "forecast_load_in"),
        forecastConversionsJobs: collectJobs(scopedChanges, "forecast_to_so_conversion"),
        cancelledForecastJobs: collectJobs(scopedChanges, "cancelled_forecast"),
        accuracy: 0, // Accuracy is now calculated separately in monthlyAccuracyData
      };

      return point;
    });

    // Filter by month range if set
    const startTime =
      startMonth === "all" ? Number.NEGATIVE_INFINITY : monthKeyToTimestamp(startMonth);
    const endTime =
      endMonth === "all" ? Number.POSITIVE_INFINITY : monthKeyToTimestamp(endMonth);

    return data.filter((d) => {
      const uploadDate = parseDateLabel(d.uploadDate);
      if (!uploadDate) return false;
      const uploadMonthKey = monthKeyFromDate(new Date(uploadDate.getFullYear(), uploadDate.getMonth(), 1));
      const uploadTime = monthKeyToTimestamp(uploadMonthKey);
      return uploadTime >= startTime && uploadTime <= endTime;
    });
  }, [uploadChanges, selectedPlatform, startMonth, endMonth, salesOrdersList, forecastSummaryList]);

  // Calculate monthly accuracy data (grouped by forecast month bucket)
  // Formula: (actual shipped quantity in that month bucket) / (max forecast quantity in that bucket month)
  const monthlyAccuracyData = useMemo<MonthlyAccuracyData[]>(() => {
    if (forecastSummaryList.length === 0) return [];

    // Collect all unique forecast months from all forecast uploads
    const forecastMonthKeys = new Set<string>();
    forecastSummaryList.forEach((forecast) => {
      forecast.months.forEach((month) => {
        forecastMonthKeys.add(month.key);
      });
    });

    // Get the most recent sales order upload for shipped data
    const mostRecentSalesOrder = salesOrdersList.length > 0 
      ? salesOrdersList[salesOrdersList.length - 1]
      : null;

    const monthlyData: MonthlyAccuracyData[] = [];

    // For each forecast month bucket, calculate accuracy
    forecastMonthKeys.forEach((forecastMonthKey) => {
      // Find MAX forecast quantity across all forecast uploads for this month
      let maxForecastQuantity = 0;
      
      forecastSummaryList.forEach((forecast) => {
        const platformTotals = forecast.totals[selectedPlatform] ?? {};
        const forecastQuantity = platformTotals[forecastMonthKey] ?? 0;
        if (forecastQuantity > maxForecastQuantity) {
          maxForecastQuantity = forecastQuantity;
        }
      });

      // Get actual shipped quantity for this month from the most recent sales order
      let actualShippedQuantity = 0;
      let hasShippedData = false;

      if (mostRecentSalesOrder) {
        const platformTotals = mostRecentSalesOrder.totals[selectedPlatform] ?? {};
        const bucket = platformTotals[forecastMonthKey];
        if (bucket && bucket.shipped && bucket.shipped > 0) {
          // Only count as having shipped data if there's actual shipped quantity > 0
          actualShippedQuantity += bucket.shipped;
          hasShippedData = true;
        }
      }

      // Only include months that have forecast data
      if (maxForecastQuantity === 0) {
        return; // Skip months with no forecast data
      }

      // Calculate accuracy: (actual shipped / max forecast) * 100
      // Only calculate if shipped data is available
      let forecastAccuracy = 0;
      if (hasShippedData && maxForecastQuantity > 0) {
        forecastAccuracy = (actualShippedQuantity / maxForecastQuantity) * 100;
      }
      // If no shipped data, accuracy remains 0 (will be displayed as "N/A" or similar)

      monthlyData.push({
        forecastMonthKey,
        forecastMonthLabel: formatMonthLabel(forecastMonthKey),
        maxForecastQuantity,
        actualShippedQuantity,
        forecastAccuracy: Math.round(forecastAccuracy * 10) / 10,
        hasShippedData,
      });
    });

    // Sort by forecast month key (chronological order)
    monthlyData.sort((a, b) => {
      const [yearA, monthA] = a.forecastMonthKey.split("-").map(Number);
      const [yearB, monthB] = b.forecastMonthKey.split("-").map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });

    return monthlyData;
  }, [forecastSummaryList, salesOrdersList, selectedPlatform]);

  // Calculate monthly summary data (grouped by upload month)
  // Shows totals: Total Shipped, Total New Forecast, Total Fcast → SO
  const monthlySummaryData = useMemo<MonthlySummaryData[]>(() => {
    if (uploadChanges.length === 0) return [];

    // Group uploads by the month they were uploaded
    const uploadsByMonth = new Map<string, UploadChanges[]>();
    uploadChanges.forEach((change) => {
      const uploadDate = parseDateLabel(change.uploadDateLabel);
      if (uploadDate) {
        const uploadMonthKey = monthKeyFromDate(uploadDate);
        const existing = uploadsByMonth.get(uploadMonthKey) || [];
        existing.push(change);
        uploadsByMonth.set(uploadMonthKey, existing);
      }
    });

    const summaryData: MonthlySummaryData[] = [];

    uploadsByMonth.forEach((uploads, uploadMonthKey) => {
      // Collect all changes from all uploads in this upload month
      const allChanges = uploads.flatMap((change) => {
        return change.changes.filter((c) => c.platform === selectedPlatform);
      });

      // Calculate totals
      let totalShipped = 0;
      let totalNewForecast = 0;
      let totalFcastToSo = 0;

      // Collect job numbers for tooltips
      const shippedJobs: string[] = [];
      const forecastLoadInsJobs: string[] = [];
      const forecastConversionsJobs: string[] = [];

      allChanges.forEach((change) => {
        if (change.type === "shipped") {
          totalShipped += change.quantity;
          if (change.jobNumbers && change.jobNumbers.length > 0) {
            shippedJobs.push(...change.jobNumbers);
          }
        } else if (change.type === "forecast_load_in") {
          totalNewForecast += change.quantity;
          if (change.jobNumbers && change.jobNumbers.length > 0) {
            forecastLoadInsJobs.push(...change.jobNumbers);
          }
        } else if (change.type === "forecast_to_so_conversion") {
          totalFcastToSo += change.quantity;
          if (change.jobNumbers && change.jobNumbers.length > 0) {
            forecastConversionsJobs.push(...change.jobNumbers);
          }
        }
      });

      summaryData.push({
        uploadMonthKey,
        uploadMonthLabel: formatMonthLabel(uploadMonthKey),
        totalShipped,
        totalNewForecast,
        totalFcastToSo,
        shippedJobs: [...new Set(shippedJobs)], // Remove duplicates
        forecastLoadInsJobs: [...new Set(forecastLoadInsJobs)], // Remove duplicates
        forecastConversionsJobs: [...new Set(forecastConversionsJobs)], // Remove duplicates
      });
    });

    // Sort by upload month key (chronological order)
    summaryData.sort((a, b) => {
      const [yearA, monthA] = a.uploadMonthKey.split("-").map(Number);
      const [yearB, monthB] = b.uploadMonthKey.split("-").map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });

    return summaryData;
  }, [uploadChanges, selectedPlatform]);

  return {
    uploadChanges,
    chartData,
    monthlyAccuracyData,
    monthlySummaryData,
  };
}

