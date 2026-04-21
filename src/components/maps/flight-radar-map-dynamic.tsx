"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const FlightRadarMap = dynamic(
  () => import("./flight-radar-map").then((m) => m.FlightRadarMap),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="h-[520px] w-full rounded-lg" />
    ),
  },
);
