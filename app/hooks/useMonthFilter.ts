'use client';

import { useCallback, useMemo, useState } from "react";
import { monthKeyToTimestamp, collectMonthOptions, parseDateLabel } from "../lib/utils/dateUtils";

type PeriodRecord = { uploadDateLabel: string };

type UseMonthFilterResult<T extends PeriodRecord, U extends PeriodRecord> = {
  fromMonth: string;
  toMonth: string;
  setFromMonth: (value: string) => void;
  setToMonth: (value: string) => void;
  fromYear: string;
  toYear: string;
  setFromYear: (value: string) => void;
  setToYear: (value: string) => void;
  availableMonths: { key: string; label: string }[];
  availableYears: number[];
  monthsByYear: Record<number, { key: string; label: string }[]>;
  filteredSalesOrdersList: T[];
  filteredForecastSummaryList: U[];
  hasActiveMonthFilter: boolean;
  filteredPeriodCount: number;
  totalPeriodCount: number;
  clearFilters: () => void;
};

export const useMonthFilter = <T extends PeriodRecord, U extends PeriodRecord>(
  salesOrdersList: T[],
  forecastSummaryList: U[],
): UseMonthFilterResult<T, U> => {
  const [fromYear, setFromYear] = useState<string>("");
  const [fromMonth, setFromMonth] = useState<string>("");
  const [toYear, setToYear] = useState<string>("");
  const [toMonth, setToMonth] = useState<string>("");

  const availableMonths = useMemo(
    () => collectMonthOptions(salesOrdersList, forecastSummaryList, parseDateLabel),
    [salesOrdersList, forecastSummaryList],
  );

  // Group months by year
  const monthsByYear = useMemo(() => {
    const grouped: Record<number, { key: string; label: string }[]> = {};
    availableMonths.forEach((month) => {
      const [year] = month.key.split("-").map(Number);
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(month);
    });
    return grouped;
  }, [availableMonths]);

  // Get available years
  const availableYears = useMemo(() => {
    return Object.keys(monthsByYear)
      .map(Number)
      .sort((a, b) => a - b);
  }, [monthsByYear]);

  // Build month key from year and month selection
  const getFromMonthKey = useCallback(() => {
    if (!fromYear || !fromMonth) return "";
    return `${fromYear}-${String(Number(fromMonth)).padStart(2, "0")}`;
  }, [fromYear, fromMonth]);

  const getToMonthKey = useCallback(() => {
    if (!toYear || !toMonth) return "";
    return `${toYear}-${String(Number(toMonth)).padStart(2, "0")}`;
  }, [toYear, toMonth]);

  const filterList = useCallback(
    <V extends PeriodRecord>(list: V[]) => {
      const fromKey = getFromMonthKey();
      const toKey = getToMonthKey();
      const fromTime = fromKey ? monthKeyToTimestamp(fromKey) : Number.NEGATIVE_INFINITY;
      const toTime = toKey ? monthKeyToTimestamp(toKey) : Number.POSITIVE_INFINITY;

      return list.filter((item) => {
        const parsedDate = parseDateLabel(item.uploadDateLabel);
        if (!parsedDate) return false;
        const monthTime = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1).getTime();
        return monthTime >= fromTime && monthTime <= toTime;
      });
    },
    [getFromMonthKey, getToMonthKey],
  );

  const filteredSalesOrdersList = useMemo(
    () => filterList(salesOrdersList),
    [filterList, salesOrdersList],
  );
  const filteredForecastSummaryList = useMemo(
    () => filterList(forecastSummaryList),
    [filterList, forecastSummaryList],
  );

  const hasActiveMonthFilter = Boolean((fromYear && fromMonth) || (toYear && toMonth));

  const filteredPeriodCount = useMemo(() => {
    return new Set([
      ...filteredSalesOrdersList.map((item) => item.uploadDateLabel),
      ...filteredForecastSummaryList.map((item) => item.uploadDateLabel),
    ]).size;
  }, [filteredSalesOrdersList, filteredForecastSummaryList]);

  const totalPeriodCount = useMemo(() => {
    return new Set([
      ...salesOrdersList.map((item) => item.uploadDateLabel),
      ...forecastSummaryList.map((item) => item.uploadDateLabel),
    ]).size;
  }, [salesOrdersList, forecastSummaryList]);

  const clearFilters = () => {
    setFromYear("");
    setFromMonth("");
    setToYear("");
    setToMonth("");
  };

  // Handle year changes - clear month if year changes
  const handleFromYearChange = useCallback((year: string) => {
    setFromYear(year);
    if (year && fromMonth) {
      // Check if the selected month exists in the new year
      const monthsInYear = monthsByYear[Number(year)] || [];
      const monthExists = monthsInYear.some((m) => {
        const [, month] = m.key.split("-").map(Number);
        return month === Number(fromMonth);
      });
      if (!monthExists) {
        setFromMonth("");
      }
    }
  }, [fromMonth, monthsByYear]);

  const handleToYearChange = useCallback((year: string) => {
    setToYear(year);
    if (year && toMonth) {
      // Check if the selected month exists in the new year
      const monthsInYear = monthsByYear[Number(year)] || [];
      const monthExists = monthsInYear.some((m) => {
        const [, month] = m.key.split("-").map(Number);
        return month === Number(toMonth);
      });
      if (!monthExists) {
        setToMonth("");
      }
    }
  }, [toMonth, monthsByYear]);

  return {
    fromMonth,
    toMonth,
    setFromMonth,
    setToMonth,
    fromYear,
    toYear,
    setFromYear: handleFromYearChange,
    setToYear: handleToYearChange,
    availableMonths,
    availableYears,
    monthsByYear,
    filteredSalesOrdersList,
    filteredForecastSummaryList,
    hasActiveMonthFilter,
    filteredPeriodCount,
    totalPeriodCount,
    clearFilters,
  };
};

