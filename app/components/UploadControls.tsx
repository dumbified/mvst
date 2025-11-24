'use client';

import { useRef } from "react";

type UploadControlsProps = {
  onSalesOrdersUpload?: (file: File) => void;
  onForecastUpload?: (file: File) => void;
  editMode?: boolean;
  onToggleEditMode?: () => void;
};

export default function UploadControls({
  onSalesOrdersUpload,
  onForecastUpload,
  editMode = false,
  onToggleEditMode,
}: UploadControlsProps) {
  const multiInputRef = useRef<HTMLInputElement>(null);

  const detectFileType = async (file: File): Promise<"sales" | "forecast" | "unknown"> => {
    try {
      const text = await file.text();
      const firstLine = text.split(/\r?\n/)[0]?.replace(/^\uFEFF/, "") ?? "";
      const headers = firstLine.split(/,|\t/).map((h) => h.replace(/\s+|\./g, "").toLowerCase());
      const hasSO =
        headers.includes("orderpart") && headers.includes("shipby") && headers.includes("orderqty");
      const hasFC =
        headers.includes("part#") && headers.includes("forecastdate") && headers.includes("forecastqty");
      if (hasSO) return "sales";
      if (hasFC) return "forecast";
      return "unknown";
    } catch {
      return "unknown";
    }
  };

  const handlePickFiles = async () => {
    if (!multiInputRef.current) return;
    // Prevent table focus/highlight when clicking the button
    // The input click is triggered programmatically
    multiInputRef.current.value = "";
    multiInputRef.current.click();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let so: File | null = null;
    let fc: File | null = null;
    const names: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i)!;
      names.push(f.name);
      const kind = await detectFileType(f);
      if (kind === "sales" && !so) so = f;
      else if (kind === "forecast" && !fc) fc = f;
    }
    if (!so || !fc) {
      window.alert(
        "Please select BOTH files:\n- Sales Orders CSV (orderpart, shipby, orderqty)\n- Forecast CSV (part#, forecastdate, forecastqty)"
      );
      // Reopen picker to prompt for both files
      setTimeout(() => {
        if (multiInputRef.current) {
          multiInputRef.current.value = "";
          multiInputRef.current.click();
        }
      }, 0);
      return;
    }
    const confirmMsg = `Selected:\n${names.join("\n")}\n\nProceed to upload and parse?`;
    const ok = window.confirm(confirmMsg);
    if (!ok) return;
    if (onSalesOrdersUpload) {
      await onSalesOrdersUpload(so);
    }
    if (onForecastUpload) {
      await onForecastUpload(fc);
    }
  };

  return (
    <div className="font-mono flex items-center gap-2">
      <input
        ref={multiInputRef}
        type="file"
        accept=".csv"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <div onMouseDown={(e) => e.preventDefault()}>
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
          onClick={handlePickFiles}
        >
          Upload
        </button>
      </div>
      <div>
        <button
          type="button"
          onClick={onToggleEditMode}
          className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ${
            editMode
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50"
          }`}
        >
          {editMode ? "Edit Mode: ON" : "Edit Mode"}
        </button>
      </div>
    </div>
  );
}