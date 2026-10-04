"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/* Grafik kütüphanesi yalnızca Spor ekranında ve istemcide yüklenir (Finans ile aynı yaklaşım). */

export const WeightChart = dynamic(() => import("./weight-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full rounded-card" />,
});

export const ActivityChart = dynamic(() => import("./activity-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full rounded-card" />,
});
