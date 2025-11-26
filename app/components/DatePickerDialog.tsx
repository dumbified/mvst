"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { formatFullDate } from "@/app/lib/salesOrders";

type DatePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: Date;
  onDateSelect: (date: Date) => void;
  anchor?: { top: number; left: number; width: number; height: number };
};

export default function DatePickerDialog({
  open,
  onOpenChange,
  date,
  onDateSelect,
  anchor,
}: DatePickerDialogProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    date
  );
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    setSelectedDate(date);
  }, [date, open]);

  const handleSelect = (newDate: Date | undefined) => {
    if (newDate) {
      setSelectedDate(newDate);
      onDateSelect(newDate);
      onOpenChange(false);
    }
  };

  if (!open || !mounted) return null;

  const handleCancel = () => {
    setSelectedDate(date);
    onOpenChange(false);
  };

  const style: React.CSSProperties = anchor
    ? {
        position: "absolute",
        top: anchor.top + anchor.height + 4,
        left: anchor.left,
        zIndex: 5000,
      }
    : {
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 5000,
      };

  const content = (
    <div className="z-50" style={style}>
      <div className="bg-white rounded-lg shadow-lg border border-neutral-200 p-3 w-[280px]">
        <div className="mb-3">
          <h3 className="text-sm font-medium mb-1">Select new date</h3>
          {selectedDate && (
            <p className="text-xs text-muted-foreground">
              Current: {formatFullDate(selectedDate)}
            </p>
          )}
        </div>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
