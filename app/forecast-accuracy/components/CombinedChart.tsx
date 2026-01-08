"use client";

import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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
          <ComposedChart data={combinedData}>
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
              <Bar yAxisId="left" dataKey="forecastLoadIns" fill="#8884d8" name="New Forecast" />
            )}
            {visibleSeries.forecastConversions && (
              <Bar yAxisId="left" dataKey="forecastConversions" fill="#82ca9d" name="Fcast → SO" />
            )}
            {visibleSeries.shipped && (
              <Bar yAxisId="left" dataKey="shippedTotal" fill="#ffc658" name="Shipped" />
            )}
            {visibleSeries.movedToLater && (
              <Bar yAxisId="left" dataKey="movedToLater" fill="#e63946" name="Delayed" />
            )}
            {visibleSeries.currentTotalSo && (
              <Bar yAxisId="left" dataKey="currentTotalSo" fill="#9ca3af" name="Total SO/Demo" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

