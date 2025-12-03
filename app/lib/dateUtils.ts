"use client";

import { formatMonthLabel, monthKeyFromDate } from "./salesOrders";
import { MONTH_ABBREVIATIONS } from "./constants";

const MONTH_LOOKUP = MONTH_ABBREVIATIONS.reduce<Record<string, number>>((acc, month, index) => {
  acc[month.toLowerCase()] = index;
  return acc;
}, {});

export const parseDateLabel = (dateLabel: string): Date | null => {
  const match = dateLabel.trim().match(/^(\d{2})(?:\s|-)([A-Za-z]{3})(?:\s|-)(\d{4})$/i);
  if (!match) return null;
  const [, dayStr, monthStrRaw, yearStr] = match;
  const monthStr = monthStrRaw.slice(0, 3).toLowerCase();
  const monthIndex = MONTH_LOOKUP[monthStr];
  if (monthIndex == null) return null;
  const day = Number(dayStr);
  const year = Number(yearStr);
  const parsed = new Date(year, monthIndex, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const buildMonthsWindow = (date: Date, monthsAhead = 6) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const months: { key: string; label: string }[] = [];
  for (let i = 0; i <= monthsAhead; i++) {
    const current = new Date(start);
    current.setMonth(current.getMonth() + i);
    const key = monthKeyFromDate(current);
    months.push({ key, label: formatMonthLabel(key) });
  }
  return months;
};

export const sortPeriodsByUploadDate = <T extends { uploadDateLabel: string }>(
  items: T[],
  parseFn: (label: string) => Date | null = parseDateLabel,
) => {
  return [...items].sort((a, b) => {
    const dateA = parseFn(a.uploadDateLabel)?.getTime() ?? 0;
    const dateB = parseFn(b.uploadDateLabel)?.getTime() ?? 0;
    return dateA - dateB;
  });
};

export const collectMonthOptions = (
  salesOrders: { uploadDateLabel: string }[],
  forecasts: { uploadDateLabel: string }[],
  parseFn: (label: string) => Date | null = parseDateLabel,
) => {
  const monthSet = new Set<string>();
  const collect = (list: { uploadDateLabel: string }[]) => {
    list.forEach((item) => {
      const parsed = parseFn(item.uploadDateLabel);
      if (!parsed) return;
      const key = monthKeyFromDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      monthSet.add(key);
    });
  };
  collect(salesOrders);
  collect(forecasts);
  return Array.from(monthSet)
    .sort()
    .map((key) => ({ key, label: formatMonthLabel(key) }));
};

export const monthKeyToTimestamp = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).getTime();
};

