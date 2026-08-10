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
  high_risk_pct: {
    label: "% vuelos riesgo alto",
    color: "var(--color-risk-high)",
  },
} satisfies ChartConfig;

function ChartSkeleton() {
  return (
    <div className="h-[220px] w-full">
      <div className="flex h-full items-end gap-1 px-4 pb-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-muted"
            style={{ height: `${28 + ((i * 17) % 53)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function HourlyDelayChart() {
  const [data, setData] = React.useState<HourlyBucket[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.hourly()
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const chartData = data.map((b) => ({
    hour:      b.hour,
    avg_proba: Math.round(b.avg_proba * 100),
    high_risk_pct: b.total > 0 ? Math.round((b.high_risk / b.total) * 100) : 0,
    high_risk_count: b.high_risk,
    total:     b.total,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Probabilidad de retraso por hora — ATL
          </CardTitle>
          {!loading && data.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-[var(--chart-1)]" />
                Prob. promedio
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-risk-high" />
                % vuelos riesgo alto
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : data.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Sin datos de predicciones para el día de hoy.
          </div>
        ) : (
          <ChartContainer config={config} className="h-[220px] w-full">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                width={36}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      if (name === "avg_proba") return [`${value}%`, "Prob. promedio"];
                      if (name === "high_risk_pct") return [`${value}%`, "% vuelos riesgo alto"];
                      return [String(value), String(name)];
                    }}
                  />
                }
              />
              <Bar
                dataKey="avg_proba"
                fill="var(--color-avg_proba)"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="high_risk_pct"
                fill="var(--color-high_risk_pct)"
                radius={[3, 3, 0, 0]}
                opacity={0.75}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
