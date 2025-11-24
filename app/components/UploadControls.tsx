'use client';

import { ChangeEvent, useMemo, useRef, useState } from "react";

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
  const [soFile, setSoFile] = useState<File | null>(null);
  const [fcFile, setFcFile] = useState<File | null>(null);
  const soInputRef = useRef<HTMLInputElement>(null);
  const fcInputRef = useRef<HTMLInputElement>(null);

  const canSave = useMemo(() => !!soFile || !!fcFile, [soFile, fcFile]);

  const handleSelectSo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSoFile(file);
  };

  const handleSelectFc = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFcFile(file);
  };

  const handleOpen = () => setOpen(true);

  const resetSelections = () => {
    setSoFile(null);
    setFcFile(null);
    if (soInputRef.current) soInputRef.current.value = "";
    if (fcInputRef.current) fcInputRef.current.value = "";
  };

  const handleCancel = () => {
    resetSelections();
    setOpen(false);
  };

  const handleSave = async () => {
    try {
      if (soFile && onSalesOrdersUpload) {
        await onSalesOrdersUpload(soFile);
      }
      if (fcFile && onForecastUpload) {
        await onForecastUpload(fcFile);
      }
    } finally {
      resetSelections();
      setOpen(false);
    }
  };

  return (
    <div className="font-mono flex items-center gap-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={handleCancel} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
            <div className="text-sm font-medium text-neutral-800 mb-2">Upload files</div>
            <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-700">Sales Orders (CSV)</div>
              <div className="flex items-center gap-2">
                <input
                  ref={soInputRef}
                  id="upload-so"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleSelectSo}
                />
                <label
                  htmlFor="upload-so"
                  className="cursor-pointer inline-flex items-center rounded-md border border-neutral-300 px-2.5 py-1 text-sm text-neutral-700 bg-white hover:bg-neutral-50"
                >
                  Choose file
                </label>
              </div>
            </div>
            {soFile ? (
              <div className="text-xs text-neutral-500 truncate">
                Selected: {soFile.name}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-sm text-neutral-700">Forecast (CSV)</div>
              <div className="flex items-center gap-2">
                <input
                  ref={fcInputRef}
                  id="upload-forecast"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleSelectFc}
                />
                <label
                  htmlFor="upload-forecast"
                  className="cursor-pointer inline-flex items-center rounded-md border border-neutral-300 px-2.5 py-1 text-sm text-neutral-700 bg-white hover:bg-neutral-50"
                >
                  Choose file
                </label>
              </div>
            </div>
            {fcFile ? (
              <div className="text-xs text-neutral-500 truncate">
                Selected: {fcFile.name}
              </div>
            ) : null}
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
                className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ${canSave ? "bg-black text-white hover:bg-neutral-800" : "bg-neutral-200 text-neutral-500 cursor-not-allowed"}`}
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );
}