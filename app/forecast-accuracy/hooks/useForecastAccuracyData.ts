import { useMemo } from "react";
import { SalesOrderSummary, formatMonthLabel, monthKeyFromDate } from "../../lib/data/salesOrders";
import { ForecastSummary } from "../../lib/data/forecasts";
import { calculateAllUploadChanges, UploadChanges } from "../../lib/data/forecastAccuracy";
import { parseDateLabel } from "../../lib/utils/dateUtils";
import { ChartDataPoint, UploadDateOption, MonthlyAccuracyData } from "../types";

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

    // Calculate data points per upload (without accuracy - that's now in monthlyAccuracyData)
    const data: ChartDataPoint[] = uploadChanges.map((change) => {
      const scopedChanges =
        selectedPlatform === "all"
          ? change.changes
          : change.changes.filter((c) => c.platform === selectedPlatform);

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
        const platformsToSum =
          selectedPlatform === "all"
            ? Object.keys(salesOrderForPeriod.totals)
            : [selectedPlatform];

        platformsToSum.forEach((platform) => {
          const platformTotals = salesOrderForPeriod.totals[platform] ?? {};
          Object.entries(platformTotals).forEach(([monthKey, bucket]) => {
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
        cancelledForecast: sums.cancelledForecast,
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

  // Calculate monthly accuracy data (grouped by upload month)
  const monthlyAccuracyData = useMemo<MonthlyAccuracyData[]>(() => {
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

    // For each upload month, calculate accuracy using monthly bucket formula
    const monthlyData: MonthlyAccuracyData[] = [];
    uploadsByMonth.forEach((uploads, uploadMonthKey) => {
      // Collect all forecast changes from all uploads in this upload month
      const allChanges = uploads.flatMap((change) => {
        return selectedPlatform === "all"
          ? change.changes
          : change.changes.filter((c) => c.platform === selectedPlatform);
      });

      // Group forecast changes by forecast monthKey (not upload month)
      const forecastChangesByMonth = new Map<string, typeof allChanges>();
      allChanges.forEach((change) => {
        if (change.monthKey && (change.type === "forecast_load_in" || change.type === "forecast_to_so_conversion")) {
          const existing = forecastChangesByMonth.get(change.monthKey) || [];
          existing.push(change);
          forecastChangesByMonth.set(change.monthKey, existing);
        }
      });

      // Calculate totals across all forecast months (for display purposes)
      let totalNewForecast = 0;
      let totalFcastToSo = 0;
      let totalShipped = 0;
      
      // Collect job numbers for accuracy calculation and tooltips
      const forecastLoadInsJobs: string[] = [];
      const forecastConversionsJobs: string[] = [];
      const shippedJobs: string[] = [];

      forecastChangesByMonth.forEach((monthChanges) => {
        // Sum quantities for each forecast month (for display)
        const monthNewForecast = monthChanges
          .filter((c) => c.type === "forecast_load_in")
          .reduce((sum, c) => sum + c.quantity, 0);
        const monthFcastToSo = monthChanges
          .filter((c) => c.type === "forecast_to_so_conversion")
          .reduce((sum, c) => sum + c.quantity, 0);

        totalNewForecast += monthNewForecast;
        totalFcastToSo += monthFcastToSo;
        
        // Collect job numbers (for accuracy calculation)
        monthChanges
          .filter((c) => c.type === "forecast_load_in" && c.jobNumbers && c.jobNumbers.length > 0)
          .forEach((c) => {
            forecastLoadInsJobs.push(...(c.jobNumbers as string[]));
          });
        
        monthChanges
          .filter((c) => c.type === "forecast_to_so_conversion" && c.jobNumbers && c.jobNumbers.length > 0)
          .forEach((c) => {
            forecastConversionsJobs.push(...(c.jobNumbers as string[]));
          });
      });

      // Calculate total shipped from all changes (not grouped by forecast month)
      allChanges
        .filter((c) => c.type === "shipped")
        .forEach((c) => {
          totalShipped += c.quantity;
          if (c.jobNumbers && c.jobNumbers.length > 0) {
            shippedJobs.push(...(c.jobNumbers as string[]));
          }
        });

      // Calculate accuracy based on unique job numbers:
      // (Number of forecasts that converted to SO by job number) / (Total forecast by job number) * 100
      const uniqueForecastJobs = new Set(forecastLoadInsJobs);
      const uniqueConvertedJobs = new Set(forecastConversionsJobs);
      
      // Only count conversions that came from forecasts (intersection)
      const convertedFromForecast = Array.from(uniqueConvertedJobs).filter(job => uniqueForecastJobs.has(job));
      
      let accuracy: number;
      const totalForecastJobCount = uniqueForecastJobs.size;
      const convertedJobCount = convertedFromForecast.length;
      
      if (totalForecastJobCount > 0) {
        // Accuracy = (converted job numbers) / (total forecast job numbers) * 100
        accuracy = (convertedJobCount / totalForecastJobCount) * 100;
      } else if (convertedJobCount > 0) {
        // If no forecasts but there are conversions, accuracy is 0%
        accuracy = 0;
      } else {
        // If both are 0, accuracy is 100% (no changes = perfect accuracy)
        accuracy = 100;
      }

      monthlyData.push({
        uploadMonthKey,
        uploadMonthLabel: formatMonthLabel(uploadMonthKey),
        totalNewForecast,
        totalFcastToSo,
        totalShipped,
        forecastAccuracy: Math.round(accuracy * 10) / 10,
        uniqueForecastJobs: totalForecastJobCount,
        uniqueConvertedJobs: convertedJobCount,
        uploadCount: uploads.length,
        forecastLoadInsJobs: [...new Set(forecastLoadInsJobs)], // Remove duplicates
        forecastConversionsJobs: [...new Set(forecastConversionsJobs)], // Remove duplicates
        shippedJobs: [...new Set(shippedJobs)], // Remove duplicates
      });
    });

    // Sort by upload month key (chronological order)
    monthlyData.sort((a, b) => {
      const [yearA, monthA] = a.uploadMonthKey.split("-").map(Number);
      const [yearB, monthB] = b.uploadMonthKey.split("-").map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });

    return monthlyData;
  }, [uploadChanges, selectedPlatform]);

  return {
    uploadChanges,
    allUploadDates,
    chartData,
    monthlyAccuracyData,
  };
}

