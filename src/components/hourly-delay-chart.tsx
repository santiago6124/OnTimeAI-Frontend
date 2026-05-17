"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { api, type HourlyBucket } from "@/lib/api";

const config = {
  avg_proba: {
    label: "Prob. retraso promedio",
    color: "var(--chart-1)",
  },
  high_risk: {
    label: "Riesgo alto",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function HourlyDelayChart() {
  const [data, setData] = React.useState<HourlyBucket[]>([]);

  React.useEffect(() => {
    api.hourly().then(setData).catch(() => setData([]));
  }, []);

  const chartData = data.map((b) => ({
    hour:      b.hour,
    avg_proba: Math.round(b.avg_proba * 100),
    high_risk: b.high_risk,
    total:     b.total,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Probabilidad de retraso por hora — ATL
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart data={chartData}>
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
              width={36}
              tickFormatter={(v) => `${v}%`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="avg_proba"
              fill="var(--color-avg_proba)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
