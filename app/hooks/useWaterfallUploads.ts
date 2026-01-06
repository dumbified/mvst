import { useCallback } from "react";
import { SalesOrderSummary, parseSalesOrdersCsv } from "../lib/data/salesOrders";
import { ForecastSummary, parseForecastCsv } from "../lib/data/forecasts";
import { uploadFileToSupabase } from "../lib/storage/storage";
import { sortPeriodsByUploadDate } from "../lib/utils/dateUtils";
import { PLATFORM_LABELS } from "../lib/core/constants";
import { fetchMachineIdData, buildMachineIdMap, convertMachineIdMapToRecord } from "../lib/data/machineIds";
import { getNextUploadId } from "../lib/utils/uploadIdUtils";

interface UseWaterfallUploadsProps {
  salesOrdersList: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
  setSalesOrdersList: (list: SalesOrderSummary[]) => void;
  setForecastSummaryList: (list: ForecastSummary[]) => void;
  persistSharedState: (sales: SalesOrderSummary[], forecasts: ForecastSummary[], bomCosts?: Record<string, number>) => Promise<void>;
  bucketName?: string;
}

/**
 * Hook to handle file uploads for sales orders and forecasts
 */
export function useWaterfallUploads({
  salesOrdersList,
  forecastSummaryList,
  setSalesOrdersList,
  setForecastSummaryList,
  persistSharedState,
  bucketName = "uploads",
}: UseWaterfallUploadsProps) {
  const handleSalesOrdersUpload = useCallback(
    async (file: File, uploadDate?: Date) => {
      try {
        await uploadFileToSupabase(bucketName, file, "sales-orders");
        const csvText = await file.text();
        const dateToUse = uploadDate ?? new Date();
        const nextId = getNextUploadId(salesOrdersList, forecastSummaryList);
        const summary = parseSalesOrdersCsv(csvText, dateToUse, nextId);
        if (summary) {
          const nextSales = sortPeriodsByUploadDate([...salesOrdersList, summary]);
          setSalesOrdersList(nextSales);
          persistSharedState(nextSales, forecastSummaryList);
        }
      } catch {
        // Failed to process Sales Orders CSV
      }
    },
    [bucketName, forecastSummaryList, persistSharedState, salesOrdersList, setSalesOrdersList],
  );

  const handleForecastUpload = useCallback(
    async (file: File, uploadDate?: Date) => {
      try {
        await uploadFileToSupabase(bucketName, file, "forecasts");
        const csvText = await file.text();
        const dateToUse = uploadDate ?? new Date();
        const nextId = getNextUploadId(salesOrdersList, forecastSummaryList);
        const summary = parseForecastCsv(csvText, dateToUse, nextId);
        if (summary) {
          // Fetch machine IDs for this forecast upload
          try {
            const machineIdData = await fetchMachineIdData();
            if (machineIdData.length > 0) {
              const { platformMonthMap } = buildMachineIdMap(machineIdData, summary.months);
              summary.machineIds = convertMachineIdMapToRecord(platformMonthMap, PLATFORM_LABELS, summary.months);
            }
          } catch {
            // Failed to fetch machine IDs, continue without them
          }
          
          const nextForecasts = sortPeriodsByUploadDate([...forecastSummaryList, summary]);
          setForecastSummaryList(nextForecasts);
          persistSharedState(salesOrdersList, nextForecasts);
        }
      } catch {
        // Failed to process Forecast CSV
      }
    },
    [bucketName, forecastSummaryList, persistSharedState, salesOrdersList, setForecastSummaryList],
  );

  const handleCombinedUpload = useCallback(
    async (soFile: File, forecastFile: File) => {
      try {
        const sharedUploadDate = new Date();
        
        // Upload both files
        await Promise.all([
          uploadFileToSupabase(bucketName, soFile, "sales-orders"),
          uploadFileToSupabase(bucketName, forecastFile, "forecasts"),
        ]);
        
        // Parse both files
        const [soText, forecastText] = await Promise.all([
          soFile.text(),
          forecastFile.text(),
        ]);
        
        // Use the same ID for both uploads since they're uploaded together
        const sharedId = getNextUploadId(salesOrdersList, forecastSummaryList);
        const soSummary = parseSalesOrdersCsv(soText, sharedUploadDate, sharedId);
        const forecastSummary = parseForecastCsv(forecastText, sharedUploadDate, sharedId);
        
        // Fetch machine IDs for forecast if it exists
        if (forecastSummary) {
          try {
            const machineIdData = await fetchMachineIdData();
            if (machineIdData.length > 0) {
              const { platformMonthMap } = buildMachineIdMap(machineIdData, forecastSummary.months);
              forecastSummary.machineIds = convertMachineIdMapToRecord(platformMonthMap, PLATFORM_LABELS, forecastSummary.months);
            }
          } catch {
            // Failed to fetch machine IDs, continue without them
          }
        }
        
        // Update both states together
        if (soSummary || forecastSummary) {
          const nextSales = soSummary 
            ? sortPeriodsByUploadDate([...salesOrdersList, soSummary])
            : salesOrdersList;
          const nextForecasts = forecastSummary
            ? sortPeriodsByUploadDate([...forecastSummaryList, forecastSummary])
            : forecastSummaryList;
          
          setSalesOrdersList(nextSales);
          setForecastSummaryList(nextForecasts);
          persistSharedState(nextSales, nextForecasts);
        }
      } catch {
        // Failed to process combined upload
      }
    },
    [bucketName, forecastSummaryList, persistSharedState, salesOrdersList, setSalesOrdersList, setForecastSummaryList],
  );

  return {
    handleSalesOrdersUpload,
    handleForecastUpload,
    handleCombinedUpload,
  };
}

