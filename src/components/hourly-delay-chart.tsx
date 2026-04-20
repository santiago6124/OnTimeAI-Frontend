"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MOCK_HOURLY_DELAY } from "@/lib/mock-data";

const config = {
  avgDelay: {
    label: "Retraso promedio (min)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function HourlyDelayChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Retraso promedio por hora — ATL
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart data={MOCK_HOURLY_DELAY}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
              width={32}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="avgDelay"
              fill="var(--color-avgDelay)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
