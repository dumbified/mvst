'use client';

import { ChangeEvent } from "react";

type UploadControlsProps = {
  onSalesOrdersUpload?: (file: File) => void;
  onForecastUpload?: (file: File) => void;
};

export default function UploadControls({ onSalesOrdersUpload, onForecastUpload }: UploadControlsProps) {
  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    callback?: (file: File) => void,
  ) => {
    const file = event.target.files?.[0];
    if (file && callback) {
      callback(file);
    }
    event.target.value = "";
  };

  return (
    <div className="flex items-center gap-2 font-mono">
      <input
        id="upload-so"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => handleFileChange(event, onSalesOrdersUpload)}
      />
      <label
        htmlFor="upload-so"
        className="cursor-pointer inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 font-mono"
      >
        Upload SO
      </label>
      <input
        id="upload-forecast"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => handleFileChange(event, onForecastUpload)}
      />
      <label
        htmlFor="upload-forecast"
        className="cursor-pointer inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 font-mono"
      >
        Upload Forecast
      </label>
    </div>
  );
}
