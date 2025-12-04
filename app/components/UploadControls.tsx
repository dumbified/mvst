'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectCsvFileType, type CsvFileType } from "../lib/csvValidation";

type UploadKey = "salesOrders" | "forecast";

type UploadFieldConfig = {
  key: UploadKey;
  label: string;
  inputId: string;
};

const createInitialFilesState = (): Record<UploadKey, File | null> => ({
  salesOrders: null,
  forecast: null,
});

const createInitialWarningsState = (): Record<UploadKey, string | null> => ({
  salesOrders: null,
  forecast: null,
});

type UploadControlsProps = {
  onSalesOrdersUpload?: (file: File, uploadDate?: Date) => void;
  onForecastUpload?: (file: File, uploadDate?: Date) => void;
  onCombinedUpload?: (soFile: File, forecastFile: File) => void;
  editMode?: boolean;
  onToggleEditMode?: () => void;
};

export default function UploadControls({
  onSalesOrdersUpload,
  onForecastUpload,
  onCombinedUpload,
  editMode = false,
  onToggleEditMode,
}: UploadControlsProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Record<UploadKey, File | null>>(createInitialFilesState);
  const [warnings, setWarnings] = useState<Record<UploadKey, string | null>>(createInitialWarningsState);
  const [confirmedFiles, setConfirmedFiles] = useState<Record<UploadKey, boolean>>({
    salesOrders: false,
    forecast: false,
  });
  const soInputRef = useRef<HTMLInputElement>(null);
  const fcInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const canSave = useMemo(() => {
    // Require both files to be uploaded
    const hasSalesOrders = !!files.salesOrders;
    const hasForecast = !!files.forecast;
    if (!hasSalesOrders || !hasForecast) {
      return false;
    }
    
    // Check if all files with warnings are confirmed
    return Object.entries(files).every(([key, file]) => {
      if (!file) return false;
      const warning = warnings[key as UploadKey];
      if (warning) {
        return confirmedFiles[key as UploadKey];
      }
      return true;
    });
  }, [files, warnings, confirmedFiles]);

  const handleOpen = () => setOpen((prev) => !prev);
  
  const handleFileChange = useCallback(
    (key: UploadKey) => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setFiles((prev) => ({ ...prev, [key]: file }));
      setConfirmedFiles((prev) => ({ ...prev, [key]: false }));
      
      if (file) {
        const detectedType = await detectCsvFileType(file);
        const expectedType: CsvFileType = key === "salesOrders" ? "salesOrders" : "forecast";
        
        if (detectedType === "unknown") {
          setWarnings((prev) => ({
            ...prev,
            [key]: "Unable to detect file type. Please ensure this is a valid CSV file.",
          }));
        } else if (detectedType !== expectedType) {
          const wrongTypeName = detectedType === "salesOrders" ? "Sales Orders" : "Forecast";
          const expectedTypeName = key === "salesOrders" ? "Sales Orders" : "Forecast";
          setWarnings((prev) => ({
            ...prev,
            [key]: `⚠️ This file appears to be a ${wrongTypeName} file, but you're uploading it as ${expectedTypeName}. Please verify the file type.`,
          }));
        } else {
          setWarnings((prev) => ({ ...prev, [key]: null }));
        }
      } else {
        setWarnings((prev) => ({ ...prev, [key]: null }));
      }
    },
    [],
  );

  const resetSelections = useCallback(() => {
    setFiles(createInitialFilesState());
    setWarnings(createInitialWarningsState());
    setConfirmedFiles({ salesOrders: false, forecast: false });
    if (soInputRef.current) soInputRef.current.value = "";
    if (fcInputRef.current) fcInputRef.current.value = "";
  }, []);

  const handleCancel = () => {
    resetSelections();
    setOpen(false);
  };

  const handleSave = async () => {
    try {
      // If both files are present, use the combined upload handler
      // This ensures they are processed together with the same date
      if (files.salesOrders && files.forecast && onCombinedUpload) {
        await onCombinedUpload(files.salesOrders, files.forecast);
      } else {
        // Otherwise, process them separately
        // Use the same upload date for both if both are being uploaded together
        const sharedUploadDate = (files.salesOrders && files.forecast) ? new Date() : undefined;
        
        if (files.salesOrders && onSalesOrdersUpload) {
          await onSalesOrdersUpload(files.salesOrders, sharedUploadDate);
        }
        if (files.forecast && onForecastUpload) {
          await onForecastUpload(files.forecast, sharedUploadDate);
        }
      }
    } finally {
      resetSelections();
      setOpen(false);
    }
  };

  const uploadFields: UploadFieldConfig[] = [
    { key: "salesOrders", label: "Sales Orders (CSV)", inputId: "upload-so" },
    { key: "forecast", label: "Forecast (CSV)", inputId: "upload-forecast" },
  ];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!controlsRef.current) return;
      if (!controlsRef.current.contains(event.target as Node)) {
        resetSelections();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, resetSelections]);

  return (
    <div className="font-mono flex items-center gap-2 relative" ref={controlsRef}>
      <div>
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
          onClick={handleOpen}
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

      {open ? (
        <div className="absolute right-0 top-full mt-2 z-[6000] w-full min-w-[400px] rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="text-sm font-medium text-neutral-800 mb-2">Upload files</div>
          <div className="space-y-4">
            {uploadFields.map((field) => {
              const isSalesOrders = field.key === "salesOrders";
              const inputRef = isSalesOrders ? soInputRef : fcInputRef;
              const file = files[field.key];
              const warning = warnings[field.key];
              const isConfirmed = confirmedFiles[field.key];

              return (
                <div key={field.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-neutral-700">{field.label}</div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        id={field.inputId}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileChange(field.key)}
                      />
                      <label
                        htmlFor={field.inputId}
                        className="cursor-pointer inline-flex items-center rounded-md border border-neutral-300 px-2.5 py-1 text-sm text-neutral-700 bg-white hover:bg-neutral-50"
                      >
                        Choose file
                      </label>
                    </div>
                  </div>
                  {file ? (
                    <div className="text-xs text-neutral-500 truncate">Selected: {file.name}</div>
                  ) : null}
                  {warning && !isConfirmed ? (
                    <div className="mt-2 p-2 rounded-md bg-amber-50 border border-amber-200">
                      <div className="text-xs text-amber-800 mb-2">{warning}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmedFiles((prev) => ({ ...prev, [field.key]: true }));
                          }}
                          className="text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
                        >
                          Proceed Anyway
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFiles((prev) => ({ ...prev, [field.key]: null }));
                            setWarnings((prev) => ({ ...prev, [field.key]: null }));
                            setConfirmedFiles((prev) => ({ ...prev, [field.key]: false }));
                            if (inputRef.current) inputRef.current.value = "";
                          }}
                          className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 bg-white hover:bg-amber-50"
                        >
                          Remove File
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {warning && isConfirmed ? (
                    <div className="mt-2 p-2 rounded-md bg-amber-50 border border-amber-200">
                      <div className="text-xs text-amber-800">
                        ⚠️ Warning acknowledged. File will be processed as {field.key === "salesOrders" ? "Sales Orders" : "Forecast"}.
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 bg-white hover:bg-neutral-50"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave}
                className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ${
                  canSave ? "bg-black text-white hover:bg-neutral-800" : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                }`}
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}