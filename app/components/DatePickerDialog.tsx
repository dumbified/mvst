"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

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
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const handlerRef = React.useRef<((event: MouseEvent) => void) | null>(null);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    setSelectedDate(date);
  }, [date, open]);

  // Close on click outside
  React.useEffect(() => {
    if (!open) {
      // Clean up handler when dialog closes
      if (handlerRef.current) {
        document.removeEventListener("mousedown", handlerRef.current);
        handlerRef.current = null;
      }
      return;
    }

    // Add a small delay to prevent immediate closing when dialog opens
    const timeoutId = setTimeout(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (!dialogRef.current) return;
        if (!dialogRef.current.contains(event.target as Node)) {
          onOpenChange(false);
        }
      };
      handlerRef.current = handleClickOutside;
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (handlerRef.current) {
        document.removeEventListener("mousedown", handlerRef.current);
        handlerRef.current = null;
      }
    };
  }, [open, onOpenChange]);

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
        top: anchor.top - anchor.height,
        left: anchor.left + anchor.width + 4,
        zIndex: 5000,
      }
    : {
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 5000,
      };

  const content = (
    <div className="z-50" style={style} ref={dialogRef}>
      <div className="bg-white rounded-lg shadow-lg border border-neutral-200 p-3 w-[280px]">
        <div className="mb-3">
          <h3 className="text-sm font-medium mb-1">Select new date</h3>
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
