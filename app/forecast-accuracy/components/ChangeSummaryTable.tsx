"use client";

import { ChartDataPoint } from "../types";

interface ChangeSummaryTableProps {
  data: ChartDataPoint[];
}

export default function ChangeSummaryTable({ data }: ChangeSummaryTableProps) {
  return (
      <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-800">Change Summary by Upload</h2>
      <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 text-neutral-700">
                <th className="border-b border-neutral-200 px-3 py-2 text-left">Upload Date</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Shipped</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Delayed</th>
                <th className="border-b border-neutral-200 px-1 py-2 text-right">New Forecast</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Fcast → SO</th>
                <th className="border-b border-neutral-200 py-2 text-right">Cancelled F&apos;cast</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Total SO</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-neutral-50 hover:bg-neutral-100/70">
                  <td className="px-3 py-2 border-t border-neutral-200">{row.uploadDate}</td>
                  <td
                    className="px-3 py-2 border-t border-neutral-200 text-right"
                    title={row.shippedJobs.length ? row.shippedJobs.join(", ") : undefined}
                  >
                    {row.shipped}
                  </td>
                  <td
                    className="px-3 py-2 border-t border-neutral-200 text-right"
                    title={row.movedToLaterJobs.length ? row.movedToLaterJobs.join(", ") : undefined}
                  >
                    {row.movedToLater}
                  </td>
                  <td
                    className="px-3 py-2 border-t border-neutral-200 text-right"
                    title={row.forecastLoadInsJobs.length ? row.forecastLoadInsJobs.join(", ") : undefined}
                  >
                    {row.forecastLoadIns}
                  </td>
                  <td
                    className="px-3 py-2 border-t border-neutral-200 text-right"
                    title={row.forecastConversionsJobs.length ? row.forecastConversionsJobs.join(", ") : undefined}
                  >
                    {row.forecastConversions}
                  </td>
                  <td
                    className="px-3 py-2 border-t border-neutral-200 text-right"
                    title={row.cancelledForecastJobs.length ? row.cancelledForecastJobs.join(", ") : undefined}
                  >
                    {row.cancelledForecast}
                  </td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right">
                    {row.currentTotalSo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

