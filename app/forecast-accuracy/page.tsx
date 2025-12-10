'use client';

import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { SalesOrderSummary } from "../lib/salesOrders";
import { ForecastSummary } from "../lib/forecasts";
import { loadSharedWaterfallState } from "../lib/stateStorage";
import { calculateAllUploadChanges, UploadChanges } from "../lib/forecastAccuracy";
import { parseDateLabel } from "../lib/dateUtils";
import { formatMonthLabel } from "../lib/salesOrders";
import { PLATFORM_LABELS, PlatformKey } from "../lib/constants";

type ChartDataPoint = {
  uploadDate: string;
  uploadDateShort: string;
  newOrders: number;
  shipped: number;
  movedToLater: number;
  forecastLoadIns: number;
  forecastConversions: number;
  accuracy: number; // Forecast accuracy percentage
  [key: string]: string | number; // For platform-specific data
};

export default function ForecastAccuracyPage() {
  const [salesOrdersList, setSalesOrdersList] = useState<SalesOrderSummary[]>([]);
  const [forecastSummaryList, setForecastSummaryList] = useState<ForecastSummary[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey | "all">("all");
  const [chartType, setChartType] = useState<"combined" | "accuracy" | "bars">("combined");
  const [visibleSeries, setVisibleSeries] = useState({
    forecastLoadIns: true,
    forecastConversions: true,
    newOrders: true,
    shipped: true,
    movedToLater: true,
  });
  const [startUpload, setStartUpload] = useState<string | "all">("all");
  const [endUpload, setEndUpload] = useState<string | "all">("all");
  const [showSeriesMenu, setShowSeriesMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const state = await loadSharedWaterfallState();
        if (state) {
          setSalesOrdersList(state.salesOrdersList || []);
          setForecastSummaryList(state.forecastSummaryList || []);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const uploadChanges = useMemo(() => {
    return calculateAllUploadChanges(salesOrdersList, forecastSummaryList);
  }, [salesOrdersList, forecastSummaryList]);

  const allUploadDates = useMemo(
    () =>
      uploadChanges.map((c) => ({
        label: c.uploadDateLabel,
        time: parseDateLabel(c.uploadDateLabel)?.getTime() ?? 0,
      })),
    [uploadChanges],
  );

  const chartData = useMemo(() => {
    if (uploadChanges.length === 0) return [];

    const data: ChartDataPoint[] = uploadChanges.map((change) => {
      const uploadDate = parseDateLabel(change.uploadDateLabel);
      const uploadDateShort = uploadDate
        ? `${uploadDate.getDate()}/${uploadDate.getMonth() + 1}/${uploadDate.getFullYear().toString().slice(-2)}`
        : change.uploadDateLabel;

      // Calculate forecast accuracy
      // Accuracy = (Forecast Conversions) / (Forecast Conversions + Forecast Load Ins) * 100
      // Or: How much of the forecast actually converted to orders
      const totalForecastActivity = change.summary.forecastConversions + change.summary.forecastLoadIns;
      const accuracy = totalForecastActivity > 0
        ? (change.summary.forecastConversions / totalForecastActivity) * 100
        : 0;

      const point: ChartDataPoint = {
        uploadDate: change.uploadDateLabel,
        uploadDateShort,
        newOrders: change.summary.newOrders,
        shipped: change.summary.shipped,
        movedToLater: change.summary.movedToLater,
        forecastLoadIns: change.summary.forecastLoadIns,
        forecastConversions: change.summary.forecastConversions,
        accuracy: Math.round(accuracy * 10) / 10, // Round to 1 decimal
      };

      // Add platform-specific data if filtering
      if (selectedPlatform !== "all") {
        const platformChanges = change.changes.filter((c) => c.platform === selectedPlatform);
        point.newOrders = platformChanges.filter((c) => c.type === "new_order").reduce((sum, c) => sum + c.quantity, 0);
        point.shipped = platformChanges.filter((c) => c.type === "shipped").reduce((sum, c) => sum + c.quantity, 0);
        point.movedToLater = platformChanges.filter((c) => c.type === "moved_to_later_month").reduce((sum, c) => sum + c.quantity, 0);
        point.forecastLoadIns = platformChanges.filter((c) => c.type === "forecast_load_in").reduce((sum, c) => sum + c.quantity, 0);
        point.forecastConversions = platformChanges.filter((c) => c.type === "forecast_to_so_conversion").reduce((sum, c) => sum + c.quantity, 0);
        
        const platformTotalForecastActivity = point.forecastConversions + point.forecastLoadIns;
        point.accuracy = platformTotalForecastActivity > 0
          ? (point.forecastConversions / platformTotalForecastActivity) * 100
          : 0;
        point.accuracy = Math.round(point.accuracy * 10) / 10;
      }

      return point;
    });

    // Filter by upload date range if set
    const startTime =
      startUpload === "all" ? Number.NEGATIVE_INFINITY : parseDateLabel(startUpload)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const endTime =
      endUpload === "all" ? Number.POSITIVE_INFINITY : parseDateLabel(endUpload)?.getTime() ?? Number.POSITIVE_INFINITY;

    return data.filter((d) => {
      const t = parseDateLabel(d.uploadDate)?.getTime() ?? 0;
      return t >= startTime && t <= endTime;
    });
  }, [uploadChanges, selectedPlatform, startUpload, endUpload]);

  if (loading) {
    return (
      <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
        <div className="flex items-center justify-center flex-1">
          <div className="text-lg">Loading data...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
      <header className="space-y-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-semibold">Forecast Accuracy</h1>
        <a
          href="/"
          className="underline text-blue-500"
        >
          ← Back to Waterfall
        </a>
      </header>

      <section className="space-y-6">
        {uploadChanges.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-600">
            No upload data available. Please upload sales orders and forecasts first.
          </div>
        ) : (
          <>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-start">
          <div className="flex flex-col gap-1">
            <label className="block text-xs font-medium text-neutral-700">Platform</label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value as PlatformKey | "all")}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs bg-white min-w-[140px]"
            >
              <option value="all">All Platforms</option>
              {PLATFORM_LABELS.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="block text-xs font-medium text-neutral-700">Chart Type</label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as "combined" | "accuracy" | "bars")}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs bg-white min-w-[150px]"
            >
              <option value="combined">Combined View</option>
              <option value="accuracy">Accuracy Only</option>
              <option value="bars">Bars Only</option>
            </select>
          </div>

          {/* Separator */}
          <div className="h-full w-px bg-neutral-200 mx-1 self-stretch" />

          <div className="flex flex-col gap-1">
            <label className="block text-xs font-medium text-neutral-700">Upload Range</label>
            <div className="flex items-center gap-2">
              <select
                value={startUpload}
                onChange={(e) => setStartUpload(e.target.value as string)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs bg-white min-w-[140px]"
              >
                <option value="all">Start: All</option>
                {allUploadDates.map((d) => (
                  <option key={`start-${d.label}`} value={d.label}>
                    {d.label}
                  </option>
                ))}
              </select>
              <span className="text-neutral-500 text-xs">to</span>
              <select
                value={endUpload}
                onChange={(e) => setEndUpload(e.target.value as string)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs bg-white min-w-[140px]"
              >
                <option value="all">End: All</option>
                {allUploadDates.map((d) => (
                  <option key={`end-${d.label}`} value={d.label}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Separator */}
          <div className="h-full w-px bg-neutral-200 mx-1 self-stretch" />

          <div className="relative">
            <label className="block text-xs font-medium text-neutral-700 mb-1">Series</label>
            <button
              type="button"
              onClick={() => setShowSeriesMenu((prev) => !prev)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs bg-white hover:bg-neutral-50 min-w-[140px] text-left"
            >
              Toggle Series ▾
            </button>
            {showSeriesMenu && (
              <div className="absolute z-[7000] mt-1 w-48 rounded-lg border border-neutral-200 bg-white shadow-lg p-3 text-xs">
                <div className="flex flex-col gap-2">
                  {[
                    { key: "forecastLoadIns", label: "New Forecast" },
                    { key: "forecastConversions", label: "F → SO" },
                    { key: "newOrders", label: "New Orders" },
                    { key: "shipped", label: "Shipped" },
                    { key: "movedToLater", label: "Delayed" },
                  ].map(({ key, label }) => (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={visibleSeries[key as keyof typeof visibleSeries]}
                        onChange={(e) =>
                          setVisibleSeries((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Combined Chart */}
        {chartType === "combined" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-800">Forecast Changes &amp; Sales Order Activity</h2>
            <div className="border border-neutral-200 rounded-lg p-3 bg-white">
              <ResponsiveContainer width="100%" height={420}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="uploadDateShort"
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis yAxisId="left" label={{ value: "Qty", angle: -90, position: "insideLeft" }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    label={{ value: "Accuracy %", angle: 90, position: "insideRight" }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "accuracy") return [`${value}%`, "Forecast Accuracy"];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Upload: ${label}`}
                  />
                  <Legend />
                  {visibleSeries.forecastLoadIns && (
                    <Bar yAxisId="left" dataKey="forecastLoadIns" fill="#8884d8" name="New Forecast" />
                  )}
                  {visibleSeries.forecastConversions && (
                    <Bar yAxisId="left" dataKey="forecastConversions" fill="#82ca9d" name="F → SO" />
                  )}
                  {visibleSeries.newOrders && (
                    <Bar yAxisId="left" dataKey="newOrders" fill="#ffc658" name="New Orders" />
                  )}
                  {visibleSeries.shipped && (
                    <Bar yAxisId="left" dataKey="shipped" fill="#ff7300" name="Shipped" />
                  )}
                  {visibleSeries.movedToLater && (
                    <Bar yAxisId="left" dataKey="movedToLater" fill="#e63946" name="Delayed" />
                  )}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#0088fe"
                    strokeWidth={2}
                    name="Forecast Accuracy %"
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bars Only Chart */}
        {chartType === "bars" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-800">Forecast &amp; Sales Orders (Bars Only)</h2>
            <div className="border border-neutral-200 rounded-lg p-3 bg-white">
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="uploadDateShort"
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis label={{ value: "Qty", angle: -90, position: "insideLeft" }} />
                  <Tooltip labelFormatter={(label) => `Upload: ${label}`} />
                  <Legend />
                  {visibleSeries.forecastLoadIns && (
                    <Bar dataKey="forecastLoadIns" fill="#8884d8" name="New Forecast" />
                  )}
                  {visibleSeries.forecastConversions && (
                    <Bar dataKey="forecastConversions" fill="#82ca9d" name="F → SO" />
                  )}
                  {visibleSeries.newOrders && (
                    <Bar dataKey="newOrders" fill="#ffc658" name="New Orders" />
                  )}
                  {visibleSeries.shipped && (
                    <Bar dataKey="shipped" fill="#ff7300" name="Shipped" />
                  )}
                  {visibleSeries.movedToLater && (
                    <Bar dataKey="movedToLater" fill="#e63946" name="Delayed" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Accuracy Only Chart */}
        {chartType === "accuracy" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-800">Forecast Accuracy Over Time</h2>
            <div className="border border-neutral-200 rounded-lg p-3 bg-white">
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="uploadDateShort"
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    label={{ value: "Accuracy %", angle: -90, position: "insideLeft" }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Forecast Accuracy"]}
                    labelFormatter={(label) => `Upload: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#0088fe"
                    strokeWidth={2}
                    name="Forecast Accuracy %"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Summary Table */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800">Change Summary by Upload</h2>
          <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-700">
                    <th className="border-b border-neutral-200 px-3 py-2 text-left">Upload Date</th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-right">New Orders</th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-right">Shipped</th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-right">Delayed</th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-right">New Forecast</th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-right">F → SO</th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-right">Accuracy %</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-neutral-50 hover:bg-neutral-100/70">
                      <td className="px-3 py-2 border-t border-neutral-200">{row.uploadDate}</td>
                      <td className="px-3 py-2 border-t border-neutral-200 text-right">{row.newOrders}</td>
                      <td className="px-3 py-2 border-t border-neutral-200 text-right">{row.shipped}</td>
                      <td className="px-3 py-2 border-t border-neutral-200 text-right">{row.movedToLater}</td>
                      <td className="px-3 py-2 border-t border-neutral-200 text-right">{row.forecastLoadIns}</td>
                      <td className="px-3 py-2 border-t border-neutral-200 text-right">{row.forecastConversions}</td>
                      <td className="px-3 py-2 border-t border-neutral-200 text-right font-semibold">
                        {row.accuracy}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
          </>
        )}
      </section>
    </main>
  );
}

