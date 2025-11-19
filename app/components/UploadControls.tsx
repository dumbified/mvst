'use client';

export default function UploadControls() {
  return (
    <div className="flex items-center gap-2">
      <input id="upload-so" type="file" accept=".csv" className="hidden" />
      <label
        htmlFor="upload-so"
        className="cursor-pointer inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
      >
        Upload Sales Orders CSV
      </label>
      <input id="upload-forecast" type="file" accept=".csv" className="hidden" />
      <label
        htmlFor="upload-forecast"
        className="cursor-pointer inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50"
      >
        Upload Forecast CSV
      </label>
    </div>
  );
}


