// UGS-132: componente de gráfico de tendencia histórica de puntualidad por ruta
// UGS-133: consume GET /api/routes/{origin}/{destination}/history
"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { RouteHistoryPoint } from "@/lib/mock-data";

const chartConfig = {
  onTimeRate: {
    label: "Puntualidad",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface RouteHistoryChartProps {
  route: string;
}

export function RouteHistoryChart({ route }: RouteHistoryChartProps) {
  const [data, setData] = useState<RouteHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);

    const [origin, destination] = route.split(" → ");
    if (!origin || !destination) return;

    fetch(`/api/routes/${origin}/${destination}/history`)
      .then((r) => {
        if (!r.ok) throw new Error("fetch error");
        return r.json();
      })
      .then((json: { data: RouteHistoryPoint[] }) => {
        setData(json.data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [route]);

  const avg =
    data.length > 0
      ? data.reduce((s, p) => s + p.onTimeRate, 0) / data.length
      : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Tendencia de puntualidad — {route}
          </CardTitle>
          {avg !== null && (
            <span
              className={
                avg >= 0.75
                  ? "text-xs font-mono text-risk-low"
                  : avg >= 0.6
                    ? "text-xs font-mono text-risk-medium"
                    : "text-xs font-mono text-risk-high"
              }
            >
              Prom. {Math.round(avg * 100)}%
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : error ? (
          <p className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
            No se pudo cargar el historial.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <LineChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="week"
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
                domain={[0.3, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              {/* línea de referencia objetivo 75% */}
              <ReferenceLine
                y={0.75}
                stroke="var(--color-onTimeRate)"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: "75%",
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      typeof value === "number"
                        ? `${Math.round(value * 100)}%`
                        : String(value)
                    }
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="onTimeRate"
                stroke="var(--color-onTimeRate)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
