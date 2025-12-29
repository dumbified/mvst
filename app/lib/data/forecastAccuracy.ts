import { SalesOrderSummary, SalesOrderBucket } from "./salesOrders";
import { ForecastSummary } from "./forecasts";
import { PlatformKey } from "../core/constants";
import { parseDateLabel } from "../utils/dateUtils";

export type ChangeType = 
  | "new_order" 
  | "shipped" 
  | "moved_to_later_month" 
  | "forecast_load_in" 
  | "forecast_to_so_conversion";

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
  };
};

// Extract a numeric sequence from a job number (e.g. "TH3K-298" -> 298, "TR3K-146-1" -> 146 or 1)
const getJobSequence = (jobNumber: string): number | null => {
  const matches = jobNumber.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  // Use the last numeric group – job numbers increment overall
  const last = matches[matches.length - 1];
  const n = Number(last);
  return Number.isFinite(n) ? n : null;
};

/**
 * Compare two Sales Order uploads and track changes
 */
function compareSalesOrders(
  previous: SalesOrderSummary | null,
  current: SalesOrderSummary,
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];

  if (!previous) {
    // First upload is treated as a baseline only – no "new_order" changes yet
    // because there are historical jobs before this that we don't have data for.
    return [];
  }

  // Build maps of previous and current jobs by platform/month
  const prevJobsByPlatformMonth = new Map<string, Set<string>>();
  const prevBucketsByPlatformMonth = new Map<string, SalesOrderBucket>();
  const prevMaxJobSeqByPlatform = new Map<PlatformKey, number>();
  
  Object.entries(previous.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, bucket]) => {
      const key = `${platform}:${monthKey}`;
      prevJobsByPlatformMonth.set(key, new Set(bucket.jobNumbers));
      prevBucketsByPlatformMonth.set(key, bucket);

      // Track the highest job number we've ever seen for this platform up to the previous upload
      bucket.jobNumbers.forEach((jobNum) => {
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
      currentJobsByPlatformMonth.set(key, new Set(bucket.jobNumbers));
      currentBucketsByPlatformMonth.set(key, bucket);
    });
  });

  // Find jobs that disappeared from previous upload
  prevJobsByPlatformMonth.forEach((prevJobs, key) => {
    const [platform, monthKey] = key.split(":");
    const currentJobs = currentJobsByPlatformMonth.get(key) ?? new Set<string>();
    const prevBucket = prevBucketsByPlatformMonth.get(key);
    
    // Track disappeared jobs
    const disappearedJobs: string[] = [];
    prevJobs.forEach((jobNumber) => {
      if (!currentJobs.has(jobNumber)) {
        disappearedJobs.push(jobNumber);
      }
    });
    
    if (disappearedJobs.length === 0) return;
    
    // For each disappeared job, determine what happened
    disappearedJobs.forEach((jobNumber) => {
      // Check if job appears in a later month (ship date slipped)
      let foundInLaterMonth = false;
      let foundInLaterMonthKey = "";
      
      // Check if job appears in an earlier month and is shipped
      let foundInEarlierMonth = false;
      let isShippedInEarlierMonth = false;
      
      // Check all months in current upload for this platform
      Object.entries(current.totals[platform as PlatformKey] ?? {}).forEach(([currMonthKey, currBucket]) => {
        if (currBucket.jobNumbers.includes(jobNumber)) {
          // Compare month keys to see if it's a later or earlier month
          const [prevYear, prevMonth] = monthKey.split("-").map(Number);
          const [currYear, currMonth] = currMonthKey.split("-").map(Number);
          const prevTime = new Date(prevYear, prevMonth - 1, 1).getTime();
          const currTime = new Date(currYear, currMonth - 1, 1).getTime();
          
          if (currTime > prevTime) {
            foundInLaterMonth = true;
            foundInLaterMonthKey = currMonthKey;
          } else if (currTime < prevTime) {
            // Job moved to an earlier month
            foundInEarlierMonth = true;
            // Check if it's marked as shipped in the current upload
            isShippedInEarlierMonth = 
              (currBucket.jobStatus && currBucket.jobStatus[jobNumber] === "shipped") ||
              (currBucket.shipped > 0);
          }
        }
      });
      
      if (foundInLaterMonth) {
        // Job moved to a later month (ship date slipped)
        // Estimate quantity: use average quantity per job in the previous bucket
        const avgQtyPerJob = prevBucket && prevBucket.jobNumbers.length > 0
          ? prevBucket.quantity / prevBucket.jobNumbers.length
          : 1;
        
        changes.push({
          type: "moved_to_later_month",
          platform: platform as PlatformKey,
          monthKey: foundInLaterMonthKey,
          quantity: Math.round(avgQtyPerJob),
          jobNumbers: [jobNumber],
          uploadDateLabel: current.uploadDateLabel,
        });
      } else if (foundInEarlierMonth && isShippedInEarlierMonth) {
        // Job moved to an earlier month and is marked as shipped in current upload
        // This means it was shipped (even if previous upload didn't have shipment status)
        const avgQtyPerJob = prevBucket && prevBucket.jobNumbers.length > 0
          ? prevBucket.quantity / prevBucket.jobNumbers.length
          : 1;
        
        changes.push({
          type: "shipped",
          platform: platform as PlatformKey,
          monthKey,
          quantity: Math.round(avgQtyPerJob),
          jobNumbers: [jobNumber],
          uploadDateLabel: current.uploadDateLabel,
        });
      } else {
        // Job completely disappeared - check if it was shipped in previous upload
        // Use per-job status when available; otherwise fall back to shipped totals
        const wasShipped =
          (prevBucket?.jobStatus && prevBucket.jobStatus[jobNumber] === "shipped") ||
          (!!prevBucket && prevBucket.shipped > 0);
        if (wasShipped) {
          // Estimate quantity: use average shipped quantity per job
          const avgShippedPerJob = prevBucket.jobNumbers.length > 0
            ? prevBucket.shipped / prevBucket.jobNumbers.length
            : 1;

          changes.push({
            type: "shipped",
            platform: platform as PlatformKey,
            monthKey,
            quantity: Math.round(avgShippedPerJob),
            jobNumbers: [jobNumber],
            uploadDateLabel: current.uploadDateLabel,
          });
        } else {
          // No shipped status, but job disappeared - mark as moved (conservative)
          const avgQtyPerJob = prevBucket && prevBucket.jobNumbers.length > 0
            ? prevBucket.quantity / prevBucket.jobNumbers.length
            : 1;
          
          changes.push({
            type: "moved_to_later_month",
            platform: platform as PlatformKey,
            monthKey,
            quantity: Math.round(avgQtyPerJob),
            jobNumbers: [jobNumber],
            uploadDateLabel: current.uploadDateLabel,
          });
        }
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

    // Estimate quantity using average per-job quantity from previous bucket (fallback to 1)
    const avgQtyPerJob =
      prevBucket.jobNumbers.length > 0 ? prevBucket.quantity / prevBucket.jobNumbers.length : 1;

    shippedNow.forEach((jobNumber) => {
      changes.push({
        type: "shipped",
        platform: platform as PlatformKey,
        monthKey,
        quantity: Math.round(avgQtyPerJob),
        jobNumbers: [jobNumber],
        uploadDateLabel: current.uploadDateLabel,
      });
    });
  });

  // Find jobs that newly appeared (new orders or moved from forecast)
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
    
    // Check which new jobs are truly new vs moved from other months
    newJobs.forEach((jobNumber) => {
      // Check if this job appears in any previous month (moved from earlier month)
      let foundInPreviousUpload = false;
      
      Object.entries(previous.totals[platform as PlatformKey] ?? {}).forEach(([, prevBucket]) => {
        if (prevBucket.jobNumbers.includes(jobNumber)) {
          foundInPreviousUpload = true;
        }
      });
      
      const seq = getJobSequence(jobNumber);
      const isSequentialNew = seq != null && seq > prevMaxSeq;

      if (!foundInPreviousUpload && isSequentialNew) {
        // Job ID not present in previous upload AND sequence is above any previous job:
        // treat as a true new order unless it arrives already shipped.
        const avgQtyPerJob = currentBucket && currentBucket.jobNumbers.length > 0
          ? currentBucket.quantity / currentBucket.jobNumbers.length
          : 1;

        const currentStatus = currentBucket?.jobStatus?.[jobNumber];
        if (currentStatus === "shipped") {
          changes.push({
            type: "shipped",
            platform: platform as PlatformKey,
            monthKey,
            quantity: Math.round(avgQtyPerJob),
            jobNumbers: [jobNumber],
            uploadDateLabel: current.uploadDateLabel,
          });
        } else if (currentStatus === "void") {
          // ignore void arrivals
        } else {
          changes.push({
            type: "new_order",
            platform: platform as PlatformKey,
            monthKey,
            quantity: Math.round(avgQtyPerJob),
            jobNumbers: [jobNumber],
            uploadDateLabel: current.uploadDateLabel,
          });
        }
      }
      // If found in previous upload but different month, it's already handled in the "disappeared" logic above
    });
  });

  return changes;
}

/**
 * Compare two Forecast uploads and track changes
 * Forecast to SO conversion: Check if jobs from previous forecast appear in current Sales Orders
 */
function compareForecasts(
  previous: ForecastSummary | null,
  current: ForecastSummary,
  currentSo: SalesOrderSummary | null,
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];

  if (!previous) {
    // First upload is a baseline only – don't mark anything as load-in yet.
    return [];
  }

  // Build a set of all job numbers in current Sales Orders for quick lookup
  const currentSoJobs = new Set<string>();
  if (currentSo) {
    Object.entries(currentSo.totals).forEach(([, monthBuckets]) => {
      Object.entries(monthBuckets).forEach(([, bucket]) => {
        bucket.jobNumbers.forEach((job) => currentSoJobs.add(job));
      });
    });
  }

  // Check for forecast conversions: jobs from previous forecast that appear in current SO
  Object.entries(previous.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, prevQty]) => {
      if (prevQty === 0) return;

      const prevMachineIds = previous.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
      if (prevMachineIds.length === 0) return;

      // Find which jobs from previous forecast appear in current Sales Orders
      const convertedJobs: string[] = [];
      prevMachineIds.forEach((jobId) => {
        if (currentSoJobs.has(jobId)) {
          convertedJobs.push(jobId);
        }
      });

      if (convertedJobs.length > 0) {
        // These jobs converted from forecast to SO
        changes.push({
          type: "forecast_to_so_conversion",
          platform: platform as PlatformKey,
          monthKey,
          quantity: convertedJobs.length, // Quantity matches number of jobs
          jobNumbers: convertedJobs,
          uploadDateLabel: current.uploadDateLabel,
        });
      }
    });
  });

  // Compare quantities per platform/month for new forecast load-ins
  Object.entries(current.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, currentQty]) => {
      const prevQty = previous.totals[platform as PlatformKey]?.[monthKey] ?? 0;
      const delta = currentQty - prevQty;

      if (delta > 0) {
        // Forecast increased - new load-in
        // Get machine IDs (job numbers) for this platform/month from current forecast
        const machineIds = current.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
        // Only include jobs that weren't in previous forecast
        const prevMachineIds = previous.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
        const prevMachineIdsSet = new Set(prevMachineIds);
        const newMachineIds = machineIds.filter((id) => !prevMachineIdsSet.has(id));
        
        changes.push({
          type: "forecast_load_in",
          platform: platform as PlatformKey,
          monthKey,
          quantity: delta,
          jobNumbers: newMachineIds.length > 0 ? newMachineIds : (machineIds.length > 0 ? machineIds : undefined),
          uploadDateLabel: current.uploadDateLabel,
        });
      }
    });
  });

  return changes;
}

/**
 * Calculate changes for a single upload compared to the previous one
 * (Internal use only - called by calculateAllUploadChanges)
 */
function calculateUploadChanges(
  salesOrdersList: SalesOrderSummary[],
  forecastSummaryList: ForecastSummary[],
  uploadDateLabel: string,
): UploadChanges | null {
  // Find current and previous uploads
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

  // Calculate SO changes
  const soChanges = currentSo ? compareSalesOrders(previousSo, currentSo) : [];

  // Calculate Forecast changes (needs current SO to check for conversions)
  const forecastChanges = currentForecast
    ? compareForecasts(previousForecast, currentForecast, currentSo)
    : [];

  const allChanges = [...soChanges, ...forecastChanges];

  // Calculate summary
  const summary = {
    shipped: allChanges.filter((c) => c.type === "shipped").reduce((sum, c) => sum + c.quantity, 0),
    movedToLater: allChanges.filter((c) => c.type === "moved_to_later_month").reduce((sum, c) => sum + c.quantity, 0),
    forecastLoadIns: allChanges.filter((c) => c.type === "forecast_load_in").reduce((sum, c) => sum + c.quantity, 0),
    forecastConversions: allChanges.filter((c) => c.type === "forecast_to_so_conversion").reduce((sum, c) => sum + c.quantity, 0),
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
      summary.forecastConversions > 0
    );
  });
  
  return filtered;
}

