"use client";
import dynamic from "next/dynamic";

// The chart library is large and the charts sit below the fold, so it loads only when a
// profile page needs it, after the page is already visible. The placeholder keeps the space.
const box = (height = 220) => function ChartPlaceholder() {
  return <div style={{ width: "100%", height }} className="animate-pulse rounded-lg bg-white/[0.03]" aria-hidden />;
};

export const RatingChart = dynamic(() => import("./charts").then((m) => m.RatingChart), { ssr: false, loading: box() });
export const MonthlyBarChart = dynamic(() => import("./charts").then((m) => m.MonthlyBarChart), { ssr: false, loading: box() });
export const WinLossDonut = dynamic(() => import("./charts").then((m) => m.WinLossDonut), { ssr: false, loading: box() });
