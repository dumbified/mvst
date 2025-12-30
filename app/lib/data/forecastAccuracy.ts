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
      
      Object.entries(current.totals[platform as PlatformKey] ?? {}).forEach(([currMonthKey, currBucket]) => {
        if (currBucket.jobNumbers.includes(jobNumber)) {
          const [prevYear, prevMonth] = monthKey.split("-").map(Number);
          const [currYear, currMonth] = currMonthKey.split("-").map(Number);
          const prevTime = new Date(prevYear, prevMonth - 1, 1).getTime();
          const currTime = new Date(currYear, currMonth - 1, 1).getTime();
          
          if (currTime > prevTime) {
            foundInLaterMonth = true;
            foundInLaterMonthKey = currMonthKey;
          } else if (currTime < prevTime) {
            foundInEarlierMonth = true;
            isShippedInEarlierMonth = 
              !!(currBucket.jobStatus && currBucket.jobStatus[jobNumber] === "shipped");
          }
        }
      });
      
      if (foundInLaterMonth) {
        // Ship date slipped - estimate quantity from previous bucket average
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
        // Job moved to earlier month and marked as shipped
        const currBucketWithJob = Object.values(current.totals[platform as PlatformKey] ?? {}).find(
          (bucket) => bucket.jobNumbers.includes(jobNumber) || 
                     (bucket.jobStatus && bucket.jobStatus[jobNumber] === "shipped")
        );
        
        let quantity = 1;
        if (currBucketWithJob && currBucketWithJob.shipped > 0) {
          let shippedJobCount = 0;
          if (currBucketWithJob.jobStatus) {
            shippedJobCount = Object.values(currBucketWithJob.jobStatus).filter(
              (status) => status === "shipped"
            ).length;
          }
          quantity = shippedJobCount > 0
            ? currBucketWithJob.shipped / shippedJobCount
            : currBucketWithJob.shipped;
        } else if (prevBucket && prevBucket.jobNumbers.length > 0) {
          quantity = prevBucket.quantity / prevBucket.jobNumbers.length;
        }
        
        changes.push({
          type: "shipped",
          platform: platform as PlatformKey,
          monthKey,
          quantity: Math.round(quantity),
          jobNumbers: [jobNumber],
          uploadDateLabel: current.uploadDateLabel,
        });
      } else {
        // Job completely disappeared - check if it was shipped (only if month is within tracking window)
        const wasShipped =
          prevBucket?.jobStatus && prevBucket.jobStatus[jobNumber] === "shipped";
        const isMonthRelevant = isMonthWithinTrackingWindow(monthKey, currentUploadDate, current.months);
        
        if (wasShipped && isMonthRelevant) {
          let shippedJobCount = 0;
          if (prevBucket?.jobStatus) {
            shippedJobCount = Object.values(prevBucket.jobStatus).filter(
              (status) => status === "shipped"
            ).length;
          }
          
          const avgShippedPerJob = shippedJobCount > 0
            ? prevBucket.shipped / shippedJobCount
            : prevBucket.shipped > 0
              ? prevBucket.shipped
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
          // No shipped status - mark as moved (conservative assumption)
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

    // Calculate shipped quantity: use current bucket's shipped quantity divided by shipped jobs
    // Count how many jobs are marked as shipped in current bucket
    let shippedJobCount = 0;
    if (currBucket.jobStatus) {
      shippedJobCount = Object.values(currBucket.jobStatus).filter(
        (status) => status === "shipped"
      ).length;
    }
    
    // Use current bucket's shipped quantity divided by shipped job count
    // This gives us the actual shipped quantity per job
    const avgShippedPerJob = shippedJobCount > 0
      ? currBucket.shipped / shippedJobCount
      : currBucket.shipped > 0
        ? currBucket.shipped
        : prevBucket.jobNumbers.length > 0
          ? prevBucket.quantity / prevBucket.jobNumbers.length
          : 1;

    shippedNow.forEach((jobNumber) => {
      changes.push({
        type: "shipped",
        platform: platform as PlatformKey,
        monthKey,
        quantity: Math.round(avgShippedPerJob),
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
        const avgQtyPerJob = currentBucket && currentBucket.jobNumbers.length > 0
          ? currentBucket.quantity / currentBucket.jobNumbers.length
          : 1;

        const currentStatus = currentBucket?.jobStatus?.[jobNumber];
        if (currentStatus === "shipped") {
          let shippedQty = avgQtyPerJob;
          if (currentBucket) {
            let shippedJobCount = 0;
            if (currentBucket.jobStatus) {
              shippedJobCount = Object.values(currentBucket.jobStatus).filter(
                (status) => status === "shipped"
              ).length;
            }
            
            if (shippedJobCount > 0 && currentBucket.shipped > 0) {
              shippedQty = currentBucket.shipped / shippedJobCount;
            } else if (currentBucket.shipped > 0) {
              shippedQty = currentBucket.shipped;
            }
          }
          
          changes.push({
            type: "shipped",
            platform: platform as PlatformKey,
            monthKey,
            quantity: Math.round(shippedQty),
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
            quantity: Math.round(avgQtyPerJob),
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

  // Check for forecast-to-SO conversions
  Object.entries(previous.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, prevQty]) => {
      if (prevQty === 0) return;

      const prevMachineIds = previous.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
      if (prevMachineIds.length === 0) return;

      const convertedJobs: string[] = [];
      prevMachineIds.forEach((jobId) => {
        if (currentSoJobs.has(jobId)) {
          convertedJobs.push(jobId);
        }
      });

      if (convertedJobs.length > 0) {
        changes.push({
          type: "forecast_to_so_conversion",
          platform: platform as PlatformKey,
          monthKey,
          quantity: convertedJobs.length,
          jobNumbers: convertedJobs,
          uploadDateLabel: current.uploadDateLabel,
        });
      }
    });
  });

  // Detect new forecast load-ins (quantity increases)
  Object.entries(current.totals).forEach(([platform, monthBuckets]) => {
    Object.entries(monthBuckets).forEach(([monthKey, currentQty]) => {
      const prevQty = previous.totals[platform as PlatformKey]?.[monthKey] ?? 0;
      const delta = currentQty - prevQty;

      if (delta > 0) {
        const machineIds = current.machineIds?.[platform as PlatformKey]?.[monthKey] ?? [];
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

