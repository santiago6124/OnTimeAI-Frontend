"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const WeatherMap = dynamic(
  () => import("./weather-map").then((m) => m.WeatherMap),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="h-[520px] w-full rounded-lg" />
    ),
  },
);
