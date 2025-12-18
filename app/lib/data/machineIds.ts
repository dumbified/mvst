import { PlatformKey, getPartNumberToPlatform } from '../core/constants';

export type MachineIdData = {
  jobPart: string;
  jobNumber: string; // This is the machine ID to show in comments
  orderType: string;
  currentBucket: string;
};

export type PlatformMonthMachineIdMap = Map<string, Set<string>>; // key: "platform|monthKey", value: Set of machineIds

/**
 * Fetches machine ID data from Google Sheets API
 */
export async function fetchMachineIdData(): Promise<MachineIdData[]> {
  try {
    const response = await fetch('/api/google-sheets');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch machine ID data: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.data || [];
  } catch {
    return [];
  }
}

/**
 * Converts month key (e.g., "2026-02") to bucket format (e.g., "Feb'26")
 */
function monthKeyToBucket(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[month - 1] || '';
  const yearShort = year.toString().slice(-2);
  return `${monthName}'${yearShort}`;
}

/**
 * Normalizes bucket string for comparison (handles variations like "Feb'26", "Feb 26", etc.)
 */
function normalizeBucket(bucket: string): string {
  // Remove all whitespace and normalize quotes/apostrophes
  return bucket.replace(/\s+/g, '').replace(/[''"]/g, "'").toLowerCase();
}

/**
 * Gets platform from job part using PART_NUMBER_TO_PLATFORM mapping
 */
function getPlatformFromJobPart(jobPart: string): PlatformKey | null {
  const normalizedPart = jobPart.trim().toLowerCase();
  const partNumberToPlatform = getPartNumberToPlatform();
  return partNumberToPlatform[normalizedPart] || null;
}

/**
 * Builds a map from platform and month to machine IDs (job numbers)
 * Key format: "platform|monthKey"
 * Machine ID is the job number itself
 */
export function buildMachineIdMap(
  machineIdData: MachineIdData[],
  months: { key: string; label: string }[]
): { platformMonthMap: PlatformMonthMachineIdMap } {
  const platformMonthMap = new Map<string, Set<string>>();
  
  // Create a lookup for month key to bucket format
  const monthBucketMap = new Map<string, string>();
  months.forEach((month) => {
    const bucket = monthKeyToBucket(month.key);
    monthBucketMap.set(month.key, bucket);
  });

  machineIdData.forEach((item) => {
    if (!item.jobNumber || item.orderType?.toLowerCase() !== 'forecast' || !item.jobPart || !item.currentBucket) {
      return;
    }

    // Get platform from job part (e.g., "9300-Ai001" -> "TH3K")
    const platform = getPlatformFromJobPart(item.jobPart);

    // Find matching month key for this bucket (format: "Feb'26")
    const normalizedBucket = normalizeBucket(item.currentBucket);
    
    for (const [monthKey, bucket] of monthBucketMap.entries()) {
      const normalizedMonthBucket = normalizeBucket(bucket);
      if (normalizedMonthBucket === normalizedBucket) {
        // Add to platform+month map
        if (platform) {
          const platformKey = `${platform}|${monthKey}`;
          if (!platformMonthMap.has(platformKey)) {
            platformMonthMap.set(platformKey, new Set());
          }
          // Machine ID (job number) for this platform+month
          platformMonthMap.get(platformKey)!.add(item.jobNumber);
        }
        break;
      }
    }
  });

  return { platformMonthMap };
}

/**
 * Gets machine IDs for a specific platform and month
 */
export function getMachineIdsForPlatformAndMonth(
  platformMonthMap: PlatformMonthMachineIdMap,
  platform: PlatformKey,
  monthKey: string
): string[] {
  const key = `${platform}|${monthKey}`;
  const machineIdSet = platformMonthMap.get(key);
  return machineIdSet ? Array.from(machineIdSet) : [];
}

/**
 * Converts PlatformMonthMachineIdMap to a Record format for storage in ForecastSummary
 */
export function convertMachineIdMapToRecord(
  platformMonthMap: PlatformMonthMachineIdMap,
  platforms: readonly PlatformKey[],
  months: { key: string; label: string }[]
): Record<PlatformKey, Record<string, string[]>> {
  const result: Record<PlatformKey, Record<string, string[]>> = {} as Record<PlatformKey, Record<string, string[]>>;
  
  platforms.forEach((platform) => {
    result[platform] = {};
    months.forEach((month) => {
      const machineIds = getMachineIdsForPlatformAndMonth(platformMonthMap, platform, month.key);
      if (machineIds.length > 0) {
        result[platform][month.key] = machineIds;
      }
    });
  });
  
  return result;
}

