import { SalesOrderSummary, SalesOrderBucket } from "./salesOrders";
import { ForecastSummary } from "./forecasts";
import { PlatformKey } from "../core/constants";
import { parseDateLabel } from "../utils/dateUtils";

export type ChangeType = 
  | "new_order" 
  | "shipped" 
  | "moved_to_later_month" 
  | "forecast_load_in" 
  | "forecast_to_so_conversion"
  | "cancelled_forecast";

export type ChangeRecord = {
  type: ChangeType;
  platform: PlatformKey;
  monthKey: string;
  quantity: number;
  jobNumbers?: string[];
  uploadDateLabel: string;
};

export type UploadChanges = {
  uploadDateLabel: string;
  changes: ChangeRecord[];
  summary: {
    shipped: number;
    movedToLater: number;
    forecastLoadIns: number;
    forecastConversions: number;
    cancelledForecast: number;
    forecastVariance: { positive: number; negative: number; positiveJobs: string[]; negativeJobs: string[] };
  };
};

/**
 * Extracts numeric sequence from job number (e.g. "TH3K-298" -> 298, "TR3K-146-1" -> 146)
 * Uses the last numeric group since job numbers increment overall
 */
const getJobSequence = (jobNumber: string): number | null => {
  const matches = jobNumber.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const n = Number(last);
  return Number.isFinite(n) ? n : null;
};

/**
 * Checks if a month is within tracking window (3 months before earliest active month)
 * Prevents very old months from being counted as newly shipped
 */
function isMonthWithinTrackingWindow(monthKey: string, currentUploadDate: Date, currentMonths: { key: string; label: string }[]): boolean {
  if (currentMonths.length === 0) return false;
  
  const currentMonthKeys = currentMonths.map(m => m.key).sort();
  const earliestCurrentMonth = currentMonthKeys[0];
  
  const [year, month] = monthKey.split("-").map(Number);
  const [earliestYear, earliestMonth] = earliestCurrentMonth.split("-").map(Number);
  
  const monthDate = new Date(year, month - 1, 1);
  const earliestDate = new Date(earliestYear, earliestMonth - 1, 1);
  
  const cutoffDate = new Date(earliestDate);
  cutoffDate.setMonth(cutoffDate.getMonth() - 3);
  
  return monthDate >= cutoffDate;
}

/**
 * Compare two Sales Order uploads and track changes
 */
function compareSalesOrders(
  previous: SalesOrderSummary | null,
  current: SalesOrderSummary,
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];

  if (!previous) {
    return [];
  }

  const currentUploadDate = parseDateLabel(current.uploadDateLabel) || new Date();

  // Build maps of previous and current jobs by platform/month
  // Include ALL jobs from jobStatus (not just jobNumbers) to track shipped jobs that disappeared
  // Only track months within tracking window to avoid counting very old shipped jobs
  const prevJobsByPlatformMonth = new Map<string, Set<string>>();
  const prevBucketsByPlatformMonth = new Map<string, SalesOrderBucket>();
  const prevMaxJobSeqByPlatform = new Map<PlatformKey, number>();
  
  Object.entries(previous.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, bucket]) => {
      if (!isMonthWithinTrackingWindow(monthKey, currentUploadDate, current.months)) {
        return;
      }
      const key = `${platform}:${monthKey}`;
      const allPrevJobs = new Set<string>();
      bucket.jobNumbers.forEach(job => allPrevJobs.add(job));
      if (bucket.jobStatus) {
        Object.keys(bucket.jobStatus).forEach(job => allPrevJobs.add(job));
      }
      prevJobsByPlatformMonth.set(key, allPrevJobs);
      prevBucketsByPlatformMonth.set(key, bucket);

      // Track highest job sequence number for this platform to identify truly new jobs
      allPrevJobs.forEach((jobNum) => {
        const seq = getJobSequence(jobNum);
        if (seq != null) {
          const p = platform as PlatformKey;
          const prevMax = prevMaxJobSeqByPlatform.get(p) ?? 0;
          if (seq > prevMax) {
            prevMaxJobSeqByPlatform.set(p, seq);
          }
        }
      });
    });
  });

  const currentJobsByPlatformMonth = new Map<string, Set<string>>();
  const currentBucketsByPlatformMonth = new Map<string, SalesOrderBucket>();
  Object.entries(current.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, bucket]) => {
      const key = `${platform}:${monthKey}`;
      const allCurrentJobs = new Set<string>();
      bucket.jobNumbers.forEach(job => allCurrentJobs.add(job));
      if (bucket.jobStatus) {
        Object.keys(bucket.jobStatus).forEach(job => allCurrentJobs.add(job));
      }
      currentJobsByPlatformMonth.set(key, allCurrentJobs);
      currentBucketsByPlatformMonth.set(key, bucket);
    });
  });

  // Find jobs that disappeared from previous upload
  prevJobsByPlatformMonth.forEach((prevJobs, key) => {
    const [platform, monthKey] = key.split(":");
    const currentJobs = currentJobsByPlatformMonth.get(key) ?? new Set<string>();
    const prevBucket = prevBucketsByPlatformMonth.get(key);
    
    const disappearedJobs: string[] = [];
    prevJobs.forEach((jobNumber) => {
      if (!currentJobs.has(jobNumber)) {
        disappearedJobs.push(jobNumber);
      }
    });
    
    if (disappearedJobs.length === 0) return;
    
    disappearedJobs.forEach((jobNumber) => {
      let foundInLaterMonth = false;
      let foundInLaterMonthKey = "";
      let foundInEarlierMonth = false;
      let isShippedInEarlierMonth = false;
      let foundInLaterMonthAndShipped = false;
      
      // Check ALL months in current upload (not just those in totals) to find where the job went
      Object.entries(current.totals[platform as PlatformKey] ?? {}).forEach(([currMonthKey, currBucket]) => {
        // Check both jobNumbers and jobStatus (shipped jobs are only in jobStatus)
        const jobFound = currBucket.jobNumbers.includes(jobNumber) || 
                         (currBucket.jobStatus && currBucket.jobStatus[jobNumber] !== undefined);
        
        if (jobFound) {
          const [prevYear, prevMonth] = monthKey.split("-").map(Number);
          const [currYear, currMonth] = currMonthKey.split("-").map(Number);
          const prevTime = new Date(prevYear, prevMonth - 1, 1).getTime();
          const currTime = new Date(currYear, currMonth - 1, 1).getTime();
          
          const isShipped = !!(currBucket.jobStatus && currBucket.jobStatus[jobNumber] === "shipped");
          
          if (currTime > prevTime) {
            // Job found in later month
            if (isShipped) {
              // If shipped in later month, track separately
              foundInLaterMonthAndShipped = true;
            } else {
              // If not shipped, count as delayed
              foundInLaterMonth = true;
              foundInLaterMonthKey = currMonthKey;
            }
          } else if (currTime < prevTime) {
            // Job found in earlier month
            foundInEarlierMonth = true;
            isShippedInEarlierMonth = isShipped;
          }
        }
      });
      
      if (foundInLaterMonthAndShipped) {
        // Job moved to later month and is shipped - count as shipped
        // 1 job = 1 quantity
        changes.push({
          type: "shipped",
          platform: platform as PlatformKey,
          monthKey,
          quantity: 1,
          jobNumbers: [jobNumber],
          uploadDateLabel: current.uploadDateLabel,
        });
      } else if (foundInLaterMonth) {
        // Ship date slipped - 1 job = 1 quantity
        changes.push({
          type: "moved_to_later_month",
          platform: platform as PlatformKey,
          monthKey: foundInLaterMonthKey,
          quantity: 1,
          jobNumbers: [jobNumber],
          uploadDateLabel: current.uploadDateLabel,
        });
      } else if (foundInEarlierMonth && isShippedInEarlierMonth) {
        // Job moved to earlier month and marked as shipped
        // 1 job = 1 quantity
        changes.push({
          type: "shipped",
          platform: platform as PlatformKey,
          monthKey,
          quantity: 1,
          jobNumbers: [jobNumber],
          uploadDateLabel: current.uploadDateLabel,
        });
      } else if (foundInEarlierMonth) {
        // Job moved to earlier month but not shipped - don't count as cancelled
        // This could be a data correction or status change, but not a cancellation
        // Don't track it as a change
      } else {
        // Job completely disappeared. Do not count disappearance as shipped.
        // Intentionally no change record here.
      }
    });
  });

  // Find jobs that are still in the same month but newly marked as shipped
  currentJobsByPlatformMonth.forEach((currentJobs, key) => {
    const [platform, monthKey] = key.split(":");
    const prevJobs = prevJobsByPlatformMonth.get(key) ?? new Set<string>();
    const prevBucket = prevBucketsByPlatformMonth.get(key);
    const currBucket = currentBucketsByPlatformMonth.get(key);
    if (!prevBucket || !currBucket || currentJobs.size === 0) return;

    const shippedNow: string[] = [];
    currentJobs.forEach((jobNumber) => {
      if (!prevJobs.has(jobNumber)) return;
      const prevStatus = prevBucket.jobStatus?.[jobNumber];
      const currStatus = currBucket.jobStatus?.[jobNumber];
      // Count as shipped if currently marked shipped and previously not shipped
      if (currStatus === "shipped" && prevStatus !== "shipped") {
        shippedNow.push(jobNumber);
      }
    });

    if (shippedNow.length === 0) return;

    // 1 job = 1 quantity
    shippedNow.forEach((jobNumber) => {
      changes.push({
        type: "shipped",
        platform: platform as PlatformKey,
        monthKey,
        quantity: 1,
        jobNumbers: [jobNumber],
        uploadDateLabel: current.uploadDateLabel,
      });
    });
  });

  // Find newly appeared jobs (new orders or moved from forecast)
  currentJobsByPlatformMonth.forEach((currentJobs, key) => {
    const [platform, monthKey] = key.split(":");
    const prevJobs = prevJobsByPlatformMonth.get(key) ?? new Set<string>();
    const currentBucket = currentBucketsByPlatformMonth.get(key);
    const platformKey = platform as PlatformKey;
    const prevMaxSeq = prevMaxJobSeqByPlatform.get(platformKey) ?? 0;
    
    const newJobs: string[] = [];
    currentJobs.forEach((jobNumber) => {
      if (!prevJobs.has(jobNumber)) {
        newJobs.push(jobNumber);
      }
    });
    
    if (newJobs.length === 0) return;
    
    newJobs.forEach((jobNumber) => {
      let foundInPreviousUpload = false;
      
      Object.entries(previous.totals[platform as PlatformKey] ?? {}).forEach(([, prevBucket]) => {
        if (prevBucket.jobNumbers.includes(jobNumber)) {
          foundInPreviousUpload = true;
        }
      });
      
      const seq = getJobSequence(jobNumber);
      const isSequentialNew = seq != null && seq > prevMaxSeq;

      if (!foundInPreviousUpload && isSequentialNew) {
        // Truly new job (not in previous upload and sequence > max seen)
        // 1 job = 1 quantity
        const currentStatus = currentBucket?.jobStatus?.[jobNumber];
        if (currentStatus === "shipped") {
          changes.push({
            type: "shipped",
            platform: platform as PlatformKey,
            monthKey,
            quantity: 1,
            jobNumbers: [jobNumber],
            uploadDateLabel: current.uploadDateLabel,
          });
        } else if (currentStatus === "void") {
          // Ignore void arrivals
        } else {
          changes.push({
            type: "new_order",
            platform: platform as PlatformKey,
            monthKey,
            quantity: 1,
            jobNumbers: [jobNumber],
            uploadDateLabel: current.uploadDateLabel,
          });
        }
      }
    });
  });

  return changes;
}

/**
 * Compares two forecast uploads and tracks changes
 * Detects forecast-to-SO conversions and new forecast load-ins
 */
function compareForecasts(
  previous: ForecastSummary | null,
  current: ForecastSummary,
  currentSo: SalesOrderSummary | null,
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];

  if (!previous) {
    return [];
  }

  const currentSoJobs = new Set<string>();
  if (currentSo) {
    Object.entries(currentSo.totals).forEach(([, monthBuckets]) => {
      Object.entries(monthBuckets).forEach(([, bucket]) => {
        bucket.jobNumbers.forEach((job) => currentSoJobs.add(job));
      });
    });
  }

  // Check for forecast-to-SO conversions and collect converted machine IDs
  const convertedMachineIds = new Set<string>();
  Object.entries(previous.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, prevQty]) => {
      if (prevQty === 0) return;

      const prevMachineIds = previous.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
      if (prevMachineIds.length === 0) return;

      const convertedJobs: string[] = [];
      prevMachineIds.forEach((jobId) => {
        if (currentSoJobs.has(jobId)) {
          convertedJobs.push(jobId);
          convertedMachineIds.add(jobId);
        }
      });

      if (convertedJobs.length > 0) {
        // Use Changed DT month bucket for conversions when available.
        // Prefer mapping from the CURRENT forecast (where the change is most recent),
        // but fall back to the PREVIOUS forecast's mapping when the bucket disappeared
        // from the current upload (e.g. month no longer exists in current.totals).
        const convMonthFromChangedDt =
          current.conversionMonthMap?.[platform as PlatformKey]?.[monthKey] ??
          previous?.conversionMonthMap?.[platform as PlatformKey]?.[monthKey];
        const conversionMonthKey = convMonthFromChangedDt ?? monthKey;

        changes.push({
          type: "forecast_to_so_conversion",
          platform: platform as PlatformKey,
          monthKey: conversionMonthKey,
          quantity: convertedJobs.length,
          jobNumbers: convertedJobs,
          uploadDateLabel: current.uploadDateLabel,
        });
      }
    });
  });

  // Collect all machine IDs from previous forecast (across ALL months) to check if they're truly new
  const allPreviousMachineIds = new Set<string>();
  Object.values(previous.machineIds || {}).forEach((monthMachineIds) => {
    Object.values(monthMachineIds).forEach((machineIds) => {
      machineIds.forEach((id) => allPreviousMachineIds.add(id));
    });
  });

  // Detect new forecast load-ins (quantity increases)
  // Only count machine IDs that didn't exist in ANY month of the previous forecast
  Object.entries(current.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, currentQty]) => {
      const prevQty = previous.totals[platform as PlatformKey]?.[monthKey] ?? 0;
      const delta = currentQty - prevQty;

      if (delta > 0) {
        const machineIds = current.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
        // Only count machine IDs that are truly new (not in any previous forecast month)
        const newMachineIds = machineIds.filter((id) => !allPreviousMachineIds.has(id));
        
        // Only create a change if there are actually new machine IDs
        if (newMachineIds.length > 0) {
          changes.push({
            type: "forecast_load_in",
            platform: platform as PlatformKey,
            monthKey,
            quantity: newMachineIds.length, // Count of new machine IDs (1 job = 1 quantity)
            jobNumbers: newMachineIds,
            uploadDateLabel: current.uploadDateLabel,
          });
        }
      }
    });
  });

  // Detect dropped forecasts (quantity decreases or completely removed)
  // Exclude forecasts that were converted to SO (those are tracked separately)
  // Also exclude forecasts that moved to a different month (those are just rescheduled, not cancelled)
  
  // First, collect all machine IDs that exist in current forecast (across all months)
  const allCurrentMachineIds = new Set<string>();
  Object.entries(current.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey]) => {
      const machineIds = current.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
      machineIds.forEach((id) => allCurrentMachineIds.add(id));
    });
  });
  
  Object.entries(previous.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, prevQty]) => {
      if (prevQty === 0) return;
      
      const currentQty = current.totals[platform as PlatformKey]?.[monthKey] ?? 0;
      const delta = currentQty - prevQty;

      if (delta < 0) {
        // Forecast quantity decreased - check if it's a drop, conversion, or moved to different month
        const prevMachineIds = previous.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
        const currentMachineIds = current.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
        const currentMachineIdsSet = new Set(currentMachineIds);
        
        // Find machine IDs that disappeared from this month
        // Exclude:
        // 1. Machine IDs that are still in this month (shouldn't happen if delta < 0, but check anyway)
        // 2. Machine IDs that were converted to SO
        // 3. Machine IDs that moved to a different month (still exist in current forecast, just different month)
        const droppedMachineIds = prevMachineIds.filter(
          (id) => 
            !currentMachineIdsSet.has(id) && // Not in current month
            !convertedMachineIds.has(id) && // Not converted to SO
            !allCurrentMachineIds.has(id) // Not in any other month (truly disappeared)
        );
        
        // Only count as cancelled forecast if there are actually dropped machine IDs
        // (not just conversions to SO or moves to different months)
        if (droppedMachineIds.length > 0) {
          changes.push({
            type: "cancelled_forecast",
            platform: platform as PlatformKey,
            monthKey,
            quantity: droppedMachineIds.length,
            jobNumbers: droppedMachineIds,
            uploadDateLabel: current.uploadDateLabel,
          });
        }
      }
    });
  });

  return changes;
}

/**
 * Calculate month difference between two month keys
 * Returns positive number if month2 is later than month1, negative if earlier
 */
function calculateMonthDifference(monthKey1: string, monthKey2: string): number {
  const [year1, month1] = monthKey1.split("-").map(Number);
  const [year2, month2] = monthKey2.split("-").map(Number);
  
  // Calculate difference in months
  const monthsDiff = (year2 - year1) * 12 + (month2 - month1);
  return monthsDiff;
}

/**
 * Calculate forecast variance by comparing previous and current forecast uploads
 * Returns { positive: number, negative: number, positiveJobs: string[], negativeJobs: string[] }
 * - Positive: forecasts moved to earlier months
 * - Negative: forecasts moved to later months
 */
function calculateForecastVariance(
  previous: ForecastSummary | null,
  current: ForecastSummary,
): { positive: number; negative: number; positiveJobs: string[]; negativeJobs: string[] } {
  if (!previous || !previous.machineIds || !current.machineIds) {
    return { positive: 0, negative: 0, positiveJobs: [], negativeJobs: [] };
  }

  // Build a map of machine ID -> previous month key
  const prevMachineIdToMonth = new Map<string, { platform: string; monthKey: string }>();
  Object.entries(previous.machineIds).forEach(([platform, monthMachineIds]) => {
    Object.entries(monthMachineIds).forEach(([monthKey, machineIds]) => {
      machineIds.forEach((machineId) => {
        prevMachineIdToMonth.set(machineId, { platform, monthKey });
      });
    });
  });

  // Build a map of machine ID -> current month key
  const currMachineIdToMonth = new Map<string, { platform: string; monthKey: string }>();
  Object.entries(current.machineIds).forEach(([platform, monthMachineIds]) => {
    Object.entries(monthMachineIds).forEach(([monthKey, machineIds]) => {
      machineIds.forEach((machineId) => {
        currMachineIdToMonth.set(machineId, { platform, monthKey });
      });
    });
  });

  let positiveVariance = 0; // Moved to earlier month
  let negativeVariance = 0; // Moved to later month
  const positiveJobs: string[] = []; // Job numbers that moved earlier
  const negativeJobs: string[] = []; // Job numbers that moved later

  // For each machine ID that exists in both previous and current
  prevMachineIdToMonth.forEach((prevInfo, machineId) => {
    const currInfo = currMachineIdToMonth.get(machineId);
    if (!currInfo) return; // Machine ID doesn't exist in current (cancelled or converted)

    // Only count if it's the same platform
    if (prevInfo.platform !== currInfo.platform) return;

    // If month changed, calculate variance
    if (prevInfo.monthKey !== currInfo.monthKey) {
      const monthDiff = calculateMonthDifference(prevInfo.monthKey, currInfo.monthKey);
      
      if (monthDiff < 0) {
        // Moved to earlier month (positive variance)
        positiveVariance += 1; // 1 machine ID = 1 quantity
        positiveJobs.push(machineId);
      } else if (monthDiff > 0) {
        // Moved to later month (negative variance)
        negativeVariance += 1; // 1 machine ID = 1 quantity
        negativeJobs.push(machineId);
      }
    }
  });

  return { positive: positiveVariance, negative: negativeVariance, positiveJobs, negativeJobs };
}

/**
 * Calculates changes for a single upload compared to the previous one
 */
function calculateUploadChanges(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
  uploadDateLabel: string,
): UploadChanges | null {
  const sortedSales = [...salesOrdersList].sort((a, b) => {
    const dateA = parseDateLabel(a.uploadDateLabel)?.getTime() ?? 0;
    const dateB = parseDateLabel(b.uploadDateLabel)?.getTime() ?? 0;
    return dateA - dateB;
  });

  const sortedForecasts = [...forecastSummaryList].sort((a, b) => {
    const dateA = parseDateLabel(a.uploadDateLabel)?.getTime() ?? 0;
    const dateB = parseDateLabel(b.uploadDateLabel)?.getTime() ?? 0;
    return dateA - dateB;
  });

  const currentSoIndex = sortedSales.findIndex((so) => so.uploadDateLabel === uploadDateLabel);
  const currentForecastIndex = sortedForecasts.findIndex((fc) => fc.uploadDateLabel === uploadDateLabel);

  if (currentSoIndex === -1 && currentForecastIndex === -1) {
    return null;
  }

  const currentSo = currentSoIndex >= 0 ? sortedSales[currentSoIndex] : null;
  const previousSo = currentSoIndex > 0 ? sortedSales[currentSoIndex - 1] : null;

  const currentForecast = currentForecastIndex >= 0 ? sortedForecasts[currentForecastIndex] : null;
  const previousForecast = currentForecastIndex > 0 ? sortedForecasts[currentForecastIndex - 1] : null;

  const soChanges = currentSo ? compareSalesOrders(previousSo, currentSo) : [];
  const forecastChanges = currentForecast
    ? compareForecasts(previousForecast, currentForecast, currentSo)
    : [];

  const allChanges = [...soChanges, ...forecastChanges];

  // Calculate forecast variance
  const forecastVariance = currentForecast && previousForecast
    ? calculateForecastVariance(previousForecast, currentForecast)
    : { positive: 0, negative: 0, positiveJobs: [], negativeJobs: [] };

  const summary = {
    shipped: allChanges.filter((c) => c.type === "shipped").reduce((sum, c) => sum + c.quantity, 0),
    movedToLater: allChanges.filter((c) => c.type === "moved_to_later_month").reduce((sum, c) => sum + c.quantity, 0),
    forecastLoadIns: allChanges.filter((c) => c.type === "forecast_load_in").reduce((sum, c) => sum + c.quantity, 0),
    forecastConversions: allChanges.filter((c) => c.type === "forecast_to_so_conversion").reduce((sum, c) => sum + c.quantity, 0),
    cancelledForecast: allChanges.filter((c) => c.type === "cancelled_forecast").reduce((sum, c) => sum + c.quantity, 0),
    forecastVariance,
  };

  return {
    uploadDateLabel,
    changes: allChanges,
    summary,
  };
}

/**
 * Calculate changes for all uploads
 */
export function calculateAllUploadChanges(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
): UploadChanges[] {
  // Get all unique upload dates
  const allUploadDates = new Set<string>();
  salesOrdersList.forEach((so) => allUploadDates.add(so.uploadDateLabel));
  forecastSummaryList.forEach((fc) => allUploadDates.add(fc.uploadDateLabel));

  const sortedDates = Array.from(allUploadDates).sort((a, b) => {
    const dateA = parseDateLabel(a)?.getTime() ?? 0;
    const dateB = parseDateLabel(b)?.getTime() ?? 0;
    return dateA - dateB;
  });

  const results = sortedDates
    .map((dateLabel) => calculateUploadChanges(salesOrdersList, forecastSummaryList, dateLabel))
    .filter((changes): changes is UploadChanges => changes !== null);

  // Filter out dates with all zeros, but keep the first upload as baseline
  if (results.length === 0) return [];
  
  // Keep first upload as baseline even if all zeros
  const filtered = results.filter((changes, index) => {
    // Always keep the first upload (baseline)
    if (index === 0) return true;
    
    // For subsequent uploads, only show if there are actual changes
    const { summary } = changes;
    return (
      summary.shipped > 0 ||
      summary.movedToLater > 0 ||
      summary.forecastLoadIns > 0 ||
      summary.forecastConversions > 0 ||
      summary.cancelledForecast > 0 ||
      summary.forecastVariance.positive > 0 ||
      summary.forecastVariance.negative > 0
    );
  });
  
  return filtered;
}

