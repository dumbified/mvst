"use client";

export default function EmptyState() {
  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
      <div className="flex items-center justify-center flex-1">
        <div className="text-lg">No upload data available. Please upload sales orders and forecasts first.</div>
      </div>
    </main>
  );
}

