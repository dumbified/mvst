"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MonthlyAccuracyData } from "../types";

interface AccuracyChartProps {
  data: MonthlyAccuracyData[];
}

export default function AccuracyChart({ data }: AccuracyChartProps) {
  // Custom tooltip formatter
  const tooltipFormatter = (
    value: number | undefined,
    name: string | undefined,
    props?: { payload?: MonthlyAccuracyData }
  ) => {
    const numValue = value ?? 0;
    return [
      `${numValue}% (${props?.payload?.actualShippedQuantity ?? 0}/${props?.payload?.maxForecastQuantity ?? 0} qty)`,
      "Forecast Accuracy"
    ];
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-800">Forecast Accuracy Over Time</h2>
      <div className="border border-neutral-200 rounded-lg p-3 bg-white">
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={data.filter(d => d.hasShippedData)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="forecastMonthLabel"
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis
              label={{ value: "Accuracy %", angle: -90, position: "insideLeft" }}
              domain={[0, 100]}
            />
            <Tooltip
              formatter={tooltipFormatter as any}
              labelFormatter={(label) => `Forecast Month: ${label ?? ""}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="forecastAccuracy"
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
  );
}

