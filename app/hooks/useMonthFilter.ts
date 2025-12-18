'use client';

import { useCallback, useMemo, useState } from "react";
import { monthKeyToTimestamp, collectMonthOptions, parseDateLabel } from "../lib/utils/dateUtils";

type PeriodRecord = { uploadDateLabel: string };

type UseMonthFilterResult<T extends PeriodRecord, U extends PeriodRecord> = {
  fromMonth: string;
  toMonth: string;
  setFromMonth: (value: string) => void;
  setToMonth: (value: string) => void;
  availableMonths: { key: string; label: string }[];
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
  const [fromMonth, setFromMonth] = useState<string>("");
  const [toMonth, setToMonth] = useState<string>("");

  const availableMonths = useMemo(
    () => collectMonthOptions(salesOrdersList, forecastSummaryList, parseDateLabel),
    [salesOrdersList, forecastSummaryList],
  );

  const filterList = useCallback(
    <V extends PeriodRecord>(list: V[]) => {
      const fromTime = fromMonth ? monthKeyToTimestamp(fromMonth) : Number.NEGATIVE_INFINITY;
      const toTime = toMonth ? monthKeyToTimestamp(toMonth) : Number.POSITIVE_INFINITY;

      return list.filter((item) => {
        const parsedDate = parseDateLabel(item.uploadDateLabel);
        if (!parsedDate) return false;
        const monthTime = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1).getTime();
        return monthTime >= fromTime && monthTime <= toTime;
      });
    },
    [fromMonth, toMonth],
  );

  const filteredSalesOrdersList = useMemo(
    () => filterList(salesOrdersList),
    [filterList, salesOrdersList],
  );
  const filteredForecastSummaryList = useMemo(
    () => filterList(forecastSummaryList),
    [filterList, forecastSummaryList],
  );

  const hasActiveMonthFilter = Boolean(fromMonth || toMonth);

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
    setFromMonth("");
    setToMonth("");
  };

  return {
    fromMonth,
    toMonth,
    setFromMonth,
    setToMonth,
    availableMonths,
    filteredSalesOrdersList,
    filteredForecastSummaryList,
    hasActiveMonthFilter,
    filteredPeriodCount,
    totalPeriodCount,
    clearFilters,
  };
};

