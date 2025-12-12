import { useState, useCallback } from "react";
import { SalesOrderSummary } from "../lib/salesOrders";
import { ForecastSummary } from "../lib/forecasts";
import { buildMonthsWindow, parseDateLabel, sortPeriodsByUploadDate } from "../lib/dateUtils";
import { formatFullDate } from "../lib/salesOrders";
import { saveSharedWaterfallState } from "../lib/stateStorage";
import { setLocalStorageTimestamp } from "../lib/localStorageUtils";

interface UseDateEditorProps {
  salesOrdersList: SalesOrderSummary[];
  forecastSummaryList: ForecastSummary[];
  bomCosts: Record<string, number>;
  setSalesOrdersList: (list: SalesOrderSummary[]) => void;
  setForecastSummaryList: (list: ForecastSummary[]) => void;
}

/**
 * Hook to manage date editing functionality
 */
export function useDateEditor({
  salesOrdersList,
  forecastSummaryList,
  bomCosts,
  setSalesOrdersList,
  setForecastSummaryList,
}: UseDateEditorProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [editingDateLabel, setEditingDateLabel] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<Date | undefined>(undefined);
  const [editingAnchor, setEditingAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const handleDateEdit = useCallback(
    (dateLabel: string, anchor?: { top: number; left: number; width: number; height: number }) => {
      if (datePickerOpen && editingDateLabel === dateLabel) {
        setDatePickerOpen(false);
        setEditingDateLabel(null);
        setEditingDate(undefined);
        setEditingAnchor(null);
        return;
      }

      // Find the current date from the label
      const currentDate = parseDateLabel(dateLabel);
      if (!currentDate) {
        return;
      }

      // Set up the date picker dialog
      setEditingDateLabel(dateLabel);
      setEditingDate(currentDate);
      setEditingAnchor(anchor ?? null);
      setDatePickerOpen(true);
    },
    [datePickerOpen, editingDateLabel]
  );

  const handleDateSelect = useCallback(
    async (newDate: Date) => {
      if (!editingDateLabel) return;

      const months = buildMonthsWindow(newDate);
      const newDateLabel = formatFullDate(newDate);

      // If the new date is the same as the old date, do nothing
      if (newDateLabel === editingDateLabel) {
        setDatePickerOpen(false);
        setEditingDateLabel(null);
        setEditingDate(undefined);
        setEditingAnchor(null);
        return;
      }

      // Update forecasts: change the date label and remove any existing record with the new date
      const nextForecasts = sortPeriodsByUploadDate(
        forecastSummaryList
          .filter((fc) => fc.uploadDateLabel !== newDateLabel) // Remove any existing record with new date
          .map((fc) =>
            fc.uploadDateLabel === editingDateLabel
              ? {
                  ...fc,
                  uploadDateLabel: newDateLabel,
                  months,
                }
              : fc,
          ),
      );

      // Update sales orders: change the date label and remove any existing record with the new date
      const nextSales = sortPeriodsByUploadDate(
        salesOrdersList
          .filter((so) => so.uploadDateLabel !== newDateLabel) // Remove any existing record with new date
          .map((so) =>
            so.uploadDateLabel === editingDateLabel
              ? {
                  ...so,
                  uploadDateLabel: newDateLabel,
                  months,
                }
              : so,
          ),
      );

      setForecastSummaryList(nextForecasts);
      setSalesOrdersList(nextSales);
      const updatedAt = new Date().toISOString();
      
      // Update localStorage immediately to prevent stale data on reload
      try {
        localStorage.setItem("mvst_salesOrdersList", JSON.stringify(nextSales));
        localStorage.setItem("mvst_forecastSummary", JSON.stringify(nextForecasts));
      } catch {
        // ignore
      }
      setLocalStorageTimestamp(updatedAt);
      
      // Save with updated timestamp
      await saveSharedWaterfallState({
        salesOrdersList: nextSales,
        forecastSummaryList: nextForecasts,
        bomCosts,
        updatedAt,
      });

      setDatePickerOpen(false);
      setEditingDateLabel(null);
      setEditingDate(undefined);
      setEditingAnchor(null);
    },
    [bomCosts, editingDateLabel, forecastSummaryList, salesOrdersList, setForecastSummaryList, setSalesOrdersList],
  );

  const closeDatePicker = useCallback(() => {
    setDatePickerOpen(false);
    setEditingDateLabel(null);
    setEditingDate(undefined);
    setEditingAnchor(null);
  }, []);

  return {
    datePickerOpen,
    editingDate,
    editingAnchor,
    handleDateEdit,
    handleDateSelect,
    closeDatePicker,
    setDatePickerOpen,
  };
}

