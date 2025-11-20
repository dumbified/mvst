'use client';

import { ChangeEvent } from "react";

type UploadControlsProps = {
  onSalesOrdersUpload?: (file: File) => void;
};

export default function UploadControls({ onSalesOrdersUpload }: UploadControlsProps) {
  const handleSalesOrdersChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onSalesOrdersUpload) {
      onSalesOrdersUpload(file);
    }
    // allow the same file to be re-uploaded if needed
    event.target.value = "";
  };

  return (
    <div className="flex items-center gap-2 font-mono">
      <input id="upload-so" type="file" accept=".csv" className="hidden" onChange={handleSalesOrdersChange} />
      <label
        htmlFor="upload-so"
        className="cursor-pointer inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 font-mono"
      >
        Upload SO
      </label>
      <input id="upload-forecast" type="file" accept=".csv" className="hidden" />
      <label
        htmlFor="upload-forecast"
        className="cursor-pointer inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 font-mono"
      >
        Upload Forecast
      </label>
    </div>
  );
}
