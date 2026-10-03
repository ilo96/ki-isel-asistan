"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Grafik kütüphanesi ağırdır; yalnızca Finans ekranında ve istemcide yüklenir.
 * Yüklenene kadar aynı boyutta iskelet görünür.
 */

export const MonthlyChart = dynamic(() => import("./monthly-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[16.5rem] w-full rounded-card" />,
});

export const CumulativeChart = dynamic(() => import("./cumulative-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[14.5rem] w-full rounded-card" />,
});

export const CategoryDonut = dynamic(() => import("./category-donut"), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto aspect-square w-full max-w-52 rounded-full" />,
});
