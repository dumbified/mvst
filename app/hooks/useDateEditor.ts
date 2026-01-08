import { useState, useCallback } from "react";
import { SalesOrderSummary } from "../lib/data/salesOrders";
import { ForecastSummary } from "../lib/data/forecasts";
import { buildMonthsWindow, parseDateLabel, sortPeriodsByUploadDate } from "../lib/utils/dateUtils";
import { formatFullDate } from "../lib/data/salesOrders";
import { saveSharedWaterfallState } from "../lib/storage/stateStorage";
import { setLocalStorageTimestamp } from "../lib/storage/localStorageUtils";

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
  const [editingKey, setEditingKey] = useState<number | string | null>(null); // upload ID (preferred) or fallback label
  const [editingDate, setEditingDate] = useState<Date | undefined>(undefined);
  const [editingAnchor, setEditingAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const handleDateEdit = useCallback(
    (
      key: number | string,
      dateLabel: string,
      anchor?: { top: number; left: number; width: number; height: number },
    ) => {
      if (datePickerOpen && editingKey === key && editingDateLabel === dateLabel) {
        setDatePickerOpen(false);
        setEditingDateLabel(null);
        setEditingKey(null);
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
      setEditingKey(key);
      setEditingDateLabel(dateLabel);
      setEditingDate(currentDate);
      setEditingAnchor(anchor ?? null);
      setDatePickerOpen(true);
    },
    [datePickerOpen, editingDateLabel, editingKey]
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

      const isEditingForecast = (fc: ForecastSummary) =>
        typeof editingKey === "number"
          ? fc.id === editingKey
          : fc.uploadDateLabel === editingDateLabel;

      // Update forecasts: change only the targeted upload's date label,
      // but keep other uploads even if they share the same date label
      const nextForecasts = sortPeriodsByUploadDate(
        forecastSummaryList.map((fc) =>
          isEditingForecast(fc)
            ? {
                ...fc,
                uploadDateLabel: newDateLabel,
                months,
              }
            : fc,
        ),
      );

      const isEditingSalesOrder = (so: SalesOrderSummary) =>
        typeof editingKey === "number"
          ? so.id === editingKey
          : so.uploadDateLabel === editingDateLabel;

      // Update sales orders: change only the targeted upload's date label,
      // but keep other uploads even if they share the same date label
      const nextSales = sortPeriodsByUploadDate(
        salesOrdersList.map((so) =>
          isEditingSalesOrder(so)
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
      setEditingKey(null);
      setEditingDate(undefined);
      setEditingAnchor(null);
    },
    [bomCosts, editingDateLabel, editingKey, forecastSummaryList, salesOrdersList, setForecastSummaryList, setSalesOrdersList],
  );

  const closeDatePicker = useCallback(() => {
    setDatePickerOpen(false);
    setEditingDateLabel(null);
    setEditingKey(null);
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

