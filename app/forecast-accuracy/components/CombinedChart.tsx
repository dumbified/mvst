"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartDataPoint } from "../types";
import { VisibleSeries } from "../types";

interface CombinedChartProps {
  data: ChartDataPoint[];
  visibleSeries: VisibleSeries;
}

export default function CombinedChart({ data, visibleSeries }: CombinedChartProps) {
  // Note: Accuracy is now calculated per forecast month bucket, not per upload month
  // So we don't show accuracy in the combined chart (which is by upload date)
  // Users should use the Accuracy Chart to see accuracy trends by forecast month

  // Combine shipped SO and shipped demo into a single data point
  const combinedData = data.map((point) => ({
    ...point,
    shippedTotal: (point.shipped || 0) + (point.shippedDemo || 0),
  }));

  // Custom tooltip formatter to show breakdown of shipped total
  const customTooltipFormatter = (
    value: number | undefined,
    name: string | undefined,
    props?: { payload?: ChartDataPoint }
  ) => {
    const numValue = value ?? 0;
    const nameStr = name ?? "";
    if (nameStr === "Shipped") {
      const shipped = props?.payload?.shipped || 0;
      const shippedDemo = props?.payload?.shippedDemo || 0;
      if (shippedDemo > 0) {
        return [`${numValue} (SO: ${shipped}, Demo: ${shippedDemo})`, nameStr];
      }
      return [numValue, nameStr];
    }
    return [numValue, nameStr];
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-800">Forecast Changes &amp; Sales Order Activity</h2>
      <div className="border border-neutral-200 rounded-lg p-3 bg-white">
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={combinedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="uploadDateShort"
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis yAxisId="left" label={{ value: "Qty", angle: -90, position: "insideLeft" }} />
            <Tooltip
              formatter={customTooltipFormatter as any}
              labelFormatter={(label) => `Upload: ${label}`}
            />
            <Legend />
            {visibleSeries.forecastLoadIns && (
              <Line yAxisId="left" type="monotone" dataKey="forecastLoadIns" stroke="#8884d8" strokeWidth={3} name="New Forecast" />
            )}
            {visibleSeries.forecastConversions && (
              <Line yAxisId="left" type="monotone" dataKey="forecastConversions" stroke="#82ca9d" strokeWidth={3} name="Fcast → SO" />
            )}
            {visibleSeries.shipped && (
              <Line yAxisId="left" type="monotone" dataKey="shippedTotal" stroke="#ffc658" strokeWidth={3} name="Shipped" />
            )}
            {visibleSeries.movedToLater && (
              <Line yAxisId="left" type="monotone" dataKey="movedToLater" stroke="#e63946" strokeWidth={3} name="Delayed" />
            )}
            {visibleSeries.currentTotalSo && (
              <Line yAxisId="left" type="monotone" dataKey="currentTotalSo" stroke="#9ca3af" strokeWidth={3} name="Total SO/Demo" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

