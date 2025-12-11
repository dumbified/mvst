import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forecast Accuracy",
};

export default function ForecastAccuracyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

