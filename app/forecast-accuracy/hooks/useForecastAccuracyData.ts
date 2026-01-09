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
      const scopedChanges =
        selectedPlatform === "overall"
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
        shippedDemo: scopedChanges.filter((c) => c.type === "shipped_demo").reduce((sum, c) => sum + c.quantity, 0),
      };

      // Calculate current total SO for this upload period
      const salesOrderForPeriod = salesOrdersList.find(
        (so) => so.uploadDateLabel === change.uploadDateLabel
      );

      let currentTotalSo = 0;
      if (salesOrderForPeriod) {
        const activeMonthKeys = new Set(salesOrderForPeriod.months.map((m) => m.key));
        if (selectedPlatform === "overall") {
          // Sum SO across all platforms for active months
          Object.values(salesOrderForPeriod.totals).forEach((platformTotals) => {
            Object.entries(platformTotals).forEach(([monthKey, bucket]) => {
              if (activeMonthKeys.has(monthKey)) {
                currentTotalSo += bucket.quantity;
              }
            });
          });
        } else {
          const platformTotals = salesOrderForPeriod.totals[selectedPlatform] ?? {};
          Object.entries(platformTotals).forEach(([monthKey, bucket]) => {
            if (activeMonthKeys.has(monthKey)) {
              currentTotalSo += bucket.quantity;
            }
          });
        }
      }

      // Filter forecast variance by platform
      let filteredForecastVariance = change.summary.forecastVariance;
      // For "overall", keep variance across all platforms
      if (selectedPlatform !== "overall") {
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
      }

      const point: ChartDataPoint = {
        uploadDate: change.uploadDateLabel,
        uploadDateShort,
        shipped: sums.shipped,
        movedToLater: sums.movedToLater,
        forecastLoadIns: sums.forecastLoadIns,
        forecastConversions: sums.forecastConversions,
        cancelledForecast: sums.cancelledForecast,
        shippedDemo: sums.shippedDemo,
        forecastVariance: filteredForecastVariance,
        currentTotalSo,
        shippedJobs: collectJobs(scopedChanges, "shipped"),
        movedToLaterJobs: collectJobs(scopedChanges, "moved_to_later_month"),
        forecastLoadInsJobs: collectJobs(scopedChanges, "forecast_load_in"),
        forecastConversionsJobs: collectJobs(scopedChanges, "forecast_to_so_conversion"),
        cancelledForecastJobs: collectJobs(scopedChanges, "cancelled_forecast"),
        shippedDemoJobs: collectJobs(scopedChanges, "shipped_demo"),
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
    // Don't calculate accuracy for "All Platforms" - only per-platform accuracy is meaningful
    if (selectedPlatform === "overall") return [];
    
    if (forecastSummaryList.length === 0) return [];

    // Collect all unique forecast months from all forecast uploads
    const forecastMonthKeys = new Set<string>();
    forecastSummaryList.forEach((forecast) => {
      forecast.months.forEach((month) => {
        forecastMonthKeys.add(month.key);
      });
    });

    if (forecastMonthKeys.size === 0) return [];

    // Build a continuous month range from earliest to latest forecast month key
    const sortedKeys = Array.from(forecastMonthKeys).sort();
    const firstKey = sortedKeys[0];
    const lastKey = sortedKeys[sortedKeys.length - 1];

    const buildContinuousMonthRange = (startKey: string, endKey: string): string[] => {
      const [startYear, startMonth] = startKey.split("-").map(Number);
      const [endYear, endMonth] = endKey.split("-").map(Number);
      const months: string[] = [];

      const current = new Date(startYear, startMonth - 1, 1);
      const end = new Date(endYear, endMonth - 1, 1);

      while (current <= end) {
        months.push(monthKeyFromDate(current));
        current.setMonth(current.getMonth() + 1);
      }

      return months;
    };

    const continuousMonthKeys = buildContinuousMonthRange(firstKey, lastKey);

    // Get the most recent sales order upload for shipped data
    const mostRecentSalesOrder = salesOrdersList.length > 0 
      ? salesOrdersList[salesOrdersList.length - 1]
      : null;

    // Helper function to get the 6 months before (including current month)
    const getSixMonthsBefore = (monthKey: string): string[] => {
      const [year, month] = monthKey.split("-").map(Number);
      const months: string[] = [];
      const current = new Date(year, month - 1, 1);
      
      // Include current month and 5 months before (total 6 months)
      for (let i = 0; i < 6; i++) {
        months.push(monthKeyFromDate(current));
        current.setMonth(current.getMonth() - 1);
      }
      
      return months;
    };

    const monthlyData: MonthlyAccuracyData[] = [];

    // For each forecast month bucket, calculate accuracy (continuous across range)
    continuousMonthKeys.forEach((forecastMonthKey) => {
      // Find MAX forecast quantity across all forecast uploads for this month
      let maxForecastQuantity = 0;
      
      forecastSummaryList.forEach((forecast) => {
        if (selectedPlatform === "overall") {
          // Sum forecast across all platforms for this month
          let totalForAllPlatforms = 0;
          Object.values(forecast.totals).forEach((platformTotals) => {
            const qty = platformTotals[forecastMonthKey] ?? 0;
            totalForAllPlatforms += qty;
          });
          if (totalForAllPlatforms > maxForecastQuantity) {
            maxForecastQuantity = totalForAllPlatforms;
          }
        } else {
          const platformTotals = forecast.totals[selectedPlatform] ?? {};
          const forecastQuantity = platformTotals[forecastMonthKey] ?? 0;
          if (forecastQuantity > maxForecastQuantity) {
            maxForecastQuantity = forecastQuantity;
          }
        }
      });

      // Get actual shipped quantity for this month from the most recent sales order
      let actualShippedQuantity = 0;
      let hasShippedData = false;
      const shippedJobs: string[] = [];

      if (mostRecentSalesOrder) {
        const collectFromBucket = (bucket: { shipped?: number; jobStatus?: Record<string, "shipped" | "open" | "void" | "other">; jobNumbers?: string[] } | undefined) => {
          if (!bucket) return;
          if (bucket.shipped && bucket.shipped > 0) {
            actualShippedQuantity += bucket.shipped;
            hasShippedData = true;
          }
          // Prefer explicit shipped jobs from jobStatus
          if (bucket.jobStatus) {
            Object.entries(bucket.jobStatus).forEach(([jobNumber, status]) => {
              if (status === "shipped") {
                shippedJobs.push(jobNumber);
              }
            });
          } else if (bucket.shipped && bucket.jobNumbers && bucket.jobNumbers.length > 0) {
            // Fallback: if no jobStatus but we have shipped qty and job numbers, include them
            shippedJobs.push(...bucket.jobNumbers);
          }
        };

        if (selectedPlatform === "overall") {
          // Sum shipped and collect shipped jobs across all platforms for this month
          Object.values(mostRecentSalesOrder.totals).forEach((platformTotals) => {
            const bucket = (platformTotals as Record<string, { shipped?: number; jobStatus?: Record<string, "shipped" | "open" | "void" | "other">; jobNumbers?: string[] }>)[forecastMonthKey];
            collectFromBucket(bucket);
          });
        } else {
          const platformTotals = mostRecentSalesOrder.totals[selectedPlatform] ?? {};
          const bucket = platformTotals[forecastMonthKey];
          collectFromBucket(bucket);
        }
      }

      // Calculate accuracy: (actual shipped / max forecast) * 100
      // Only calculate if shipped data is available
      let forecastAccuracy = 0;
      if (hasShippedData && maxForecastQuantity > 0) {
        forecastAccuracy = (actualShippedQuantity / maxForecastQuantity) * 100;
      }
      // If no shipped data, accuracy remains 0 (will be displayed as "N/A" or similar)

      // Calculate 6-month rolling accuracy
      // Formula: current month actual shipped / max forecasted quantity in the 6 months before (including current)
      let sixMonthRollingAccuracy = 0;
      let maxForecastInSixMonths = 0;
      
      if (hasShippedData) {
        const sixMonthsKeys = getSixMonthsBefore(forecastMonthKey);
        
        // Find MAX forecast quantity across all forecast uploads for these 6 months
        sixMonthsKeys.forEach((monthKey) => {
          forecastSummaryList.forEach((forecast) => {
            if (selectedPlatform === "overall") {
              // Sum forecast across all platforms for this month
              let totalForAllPlatforms = 0;
              Object.values(forecast.totals).forEach((platformTotals) => {
                const qty = platformTotals[monthKey] ?? 0;
                totalForAllPlatforms += qty;
              });
              if (totalForAllPlatforms > maxForecastInSixMonths) {
                maxForecastInSixMonths = totalForAllPlatforms;
              }
            } else {
              const platformTotals = forecast.totals[selectedPlatform] ?? {};
              const forecastQuantity = platformTotals[monthKey] ?? 0;
              if (forecastQuantity > maxForecastInSixMonths) {
                maxForecastInSixMonths = forecastQuantity;
              }
            }
          });
        });
        
        // Calculate: current month actual shipped / max forecast in 6 months * 100
        if (maxForecastInSixMonths > 0) {
          sixMonthRollingAccuracy = (actualShippedQuantity / maxForecastInSixMonths) * 100;
        }
      }

      monthlyData.push({
        forecastMonthKey,
        forecastMonthLabel: formatMonthLabel(forecastMonthKey),
        maxForecastQuantity,
        actualShippedQuantity,
        forecastAccuracy: Math.round(forecastAccuracy * 10) / 10,
        hasShippedData,
        shippedJobs: shippedJobs.length > 0 ? Array.from(new Set(shippedJobs)) : [],
        sixMonthRollingAccuracy: hasShippedData ? Math.round(sixMonthRollingAccuracy * 10) / 10 : undefined,
        maxForecastInSixMonths: hasShippedData ? maxForecastInSixMonths : undefined,
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

  // Calculate monthly summary data (grouped by month bucket, not upload month)
  // Shows totals per bucket: Total Shipped (actual shipped from latest SO snapshot),
  // Total New Forecast, Total Fcast → SO
  const monthlySummaryData = useMemo<MonthlySummaryData[]>(() => {
    if (uploadChanges.length === 0) return [];

    const isFutureMonth = (key: string) => {
      const [y, m] = key.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      const now = new Date();
      return d > now;
    };

    // Months currently visible in the demand waterfall (union of SO + Forecast months)
    const allowedMonthKeys = new Set<string>();
    salesOrdersList.forEach((so) => {
      so.months.forEach((m) => allowedMonthKeys.add(m.key));
    });
    forecastSummaryList.forEach((fc) => {
      fc.months.forEach((m) => allowedMonthKeys.add(m.key));
    });

    // Map each forecast upload to its Forecast load-ins date bucket month (if available)
    // Used only for the "Total New Forecast" column so that it follows the Forecast load-ins date.
    const loadInsMonthByUpload = new Map<string, string>();
    forecastSummaryList.forEach((fc) => {
      if (fc.forecastLoadInsDateLabel) {
        const loadInsDate = parseDateLabel(fc.forecastLoadInsDateLabel);
        if (loadInsDate) {
          loadInsMonthByUpload.set(fc.uploadDateLabel, monthKeyFromDate(loadInsDate));
        }
      }
    });

    // Group changes by their month bucket (change.monthKey) for forecast/new-forecast/conversions.
    // We will override totalShipped with actual shipped from the latest SO snapshot below.
    const byBucketMonth = new Map<string, {
      totalShipped: number;
      totalNewForecast: number;
      totalFcastToSo: number;
      shippedJobs: string[];
      forecastLoadInsJobs: string[];
      forecastConversionsJobs: string[];
    }>();

    uploadChanges.forEach((upload) => {
      const scopedChanges =
        selectedPlatform === "overall"
          ? upload.changes
          : upload.changes.filter((c) => c.platform === selectedPlatform);

      scopedChanges.forEach((change) => {
        // Default bucket month is the change's monthKey (forecast / shipped bucket)
        // For "forecast_load_in" we prefer the Forecast load-ins date bucket month if available.
        let bucketMonthKey = change.monthKey;
        if (change.type === "forecast_load_in") {
          const loadInsKey = loadInsMonthByUpload.get(change.uploadDateLabel);
          if (loadInsKey) {
            bucketMonthKey = loadInsKey;
          }
        }

        if (isFutureMonth(bucketMonthKey)) return;

        let agg = byBucketMonth.get(bucketMonthKey);
        if (!agg) {
          agg = {
            totalShipped: 0,
            totalNewForecast: 0,
            totalFcastToSo: 0,
            shippedJobs: [],
            forecastLoadInsJobs: [],
            forecastConversionsJobs: [],
          };
          byBucketMonth.set(bucketMonthKey, agg);
        }

        if (change.type === "shipped") {
          // We'll replace totalShipped later with actual shipped snapshot; keep jobs for tooltips.
          if (change.jobNumbers && change.jobNumbers.length > 0) {
            agg.shippedJobs.push(...change.jobNumbers);
          }
        } else if (change.type === "forecast_load_in") {
          agg.totalNewForecast += change.quantity;
          if (change.jobNumbers && change.jobNumbers.length > 0) {
            agg.forecastLoadInsJobs.push(...change.jobNumbers);
          }
        } else if (change.type === "forecast_to_so_conversion") {
          agg.totalFcastToSo += change.quantity;
          if (change.jobNumbers && change.jobNumbers.length > 0) {
            agg.forecastConversionsJobs.push(...change.jobNumbers);
          }
        }
      });
    });

    // Build summary data from change map
    const summaryData: MonthlySummaryData[] = [];
    byBucketMonth.forEach((agg, bucketMonthKey) => {
      if (!allowedMonthKeys.has(bucketMonthKey)) return;
      summaryData.push({
        uploadMonthKey: bucketMonthKey,
        uploadMonthLabel: formatMonthLabel(bucketMonthKey),
        totalShipped: agg.totalShipped, // will override below
        totalNewForecast: agg.totalNewForecast,
        totalFcastToSo: agg.totalFcastToSo,
        shippedJobs: [...new Set(agg.shippedJobs)],
        forecastLoadInsJobs: [...new Set(agg.forecastLoadInsJobs)],
        forecastConversionsJobs: [...new Set(agg.forecastConversionsJobs)],
      });
    });

    // Override Total Shipped with actual shipped from the latest SO snapshot
    if (salesOrdersList.length > 0) {
      const latestSo = [...salesOrdersList].sort(
        (a, b) => (parseDateLabel(b.uploadDateLabel)?.getTime() ?? 0) - (parseDateLabel(a.uploadDateLabel)?.getTime() ?? 0)
      )[0];

      if (latestSo) {
        const addShipped = (platformKey: string, monthKey: string, qty: number) => {
          if (!allowedMonthKeys.has(monthKey) || isFutureMonth(monthKey)) return;
          let entry = summaryData.find((s) => s.uploadMonthKey === monthKey);
          if (!entry) {
            entry = {
              uploadMonthKey: monthKey,
              uploadMonthLabel: formatMonthLabel(monthKey),
              totalShipped: 0,
              totalNewForecast: 0,
              totalFcastToSo: 0,
              shippedJobs: [],
              forecastLoadInsJobs: [],
              forecastConversionsJobs: [],
            };
            summaryData.push(entry);
          }
          entry.totalShipped += qty;
        };

        Object.entries(latestSo.totals).forEach(([platform, monthBuckets]) => {
          if (selectedPlatform !== "overall" && platform !== selectedPlatform) return;
          Object.entries(monthBuckets).forEach(([monthKey, bucket]) => {
            const shippedQty = Number(bucket.shipped ?? 0);
            if (shippedQty > 0) {
              addShipped(platform, monthKey, shippedQty);
            }
          });
        });
      }
    }

    // Ensure past/ongoing months that exist in waterfall are present even if zero
    const now = new Date();
    allowedMonthKeys.forEach((monthKey) => {
      const [y, m] = monthKey.split("-").map(Number);
      const monthDate = new Date(y, m - 1, 1);
      if (monthDate > now) return; // only include months that have happened or current
      const existing = summaryData.find((s) => s.uploadMonthKey === monthKey);
      if (!existing) {
        summaryData.push({
          uploadMonthKey: monthKey,
          uploadMonthLabel: formatMonthLabel(monthKey),
          totalShipped: 0,
          totalNewForecast: 0,
          totalFcastToSo: 0,
          shippedJobs: [],
          forecastLoadInsJobs: [],
          forecastConversionsJobs: [],
        });
      }
    });

    // Sort by bucket month key (chronological order)
    summaryData.sort((a, b) => {
      const [yearA, monthA] = a.uploadMonthKey.split("-").map(Number);
      const [yearB, monthB] = b.uploadMonthKey.split("-").map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });

    return summaryData;
  }, [uploadChanges, selectedPlatform, forecastSummaryList, salesOrdersList]);

  return {
    uploadChanges,
    chartData,
    monthlyAccuracyData,
    monthlySummaryData,
  };
}

