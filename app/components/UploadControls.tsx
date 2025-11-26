'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Record<UploadKey, File | null>>(createInitialFilesState);
  const soInputRef = useRef<HTMLInputElement>(null);
  const fcInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const canSave = useMemo(() => Object.values(files).some(Boolean), [files]);

  const handleOpen = () => setOpen((prev) => !prev);
  const handleFileChange = useCallback(
    (key: UploadKey) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setFiles((prev) => ({ ...prev, [key]: file }));
    },
    [],
  );

  const resetSelections = useCallback(() => {
    setFiles(createInitialFilesState());
    if (soInputRef.current) soInputRef.current.value = "";
    if (fcInputRef.current) fcInputRef.current.value = "";
  }, []);

  const handleCancel = () => {
    resetSelections();
    setOpen(false);
  };

  const handleSave = async () => {
    try {
      if (files.salesOrders && onSalesOrdersUpload) {
        await onSalesOrdersUpload(files.salesOrders);
      }
      if (files.forecast && onForecastUpload) {
        await onForecastUpload(files.forecast);
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