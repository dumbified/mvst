"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartDataPoint } from "../types";
import { VisibleSeries } from "../types";

interface CombinedChartProps {
  data: ChartDataPoint[];
  visibleSeries: VisibleSeries;
}

export default function CombinedChart({ data, visibleSeries }: CombinedChartProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-800">Forecast Changes &amp; Sales Order Activity</h2>
      <div className="border border-neutral-200 rounded-lg p-3 bg-white">
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart data={data}>
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
  );
}

