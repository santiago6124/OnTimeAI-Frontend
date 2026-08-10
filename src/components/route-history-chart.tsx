"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { api, type RouteHistoryPoint } from "@/lib/api";

const chartConfig = {
  on_time_rate: { label: "Puntualidad", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function RouteHistoryChart({ origin, dest }: { origin: string; dest: string }) {
  const routeKey = `${origin}:${dest}`;
  const [state, setState] = useState<{
    key: string;
    data: RouteHistoryPoint[];
    error: boolean;
  }>({ key: "", data: [], error: false });

  useEffect(() => {
    if (!origin || !dest) return;
    let active = true;
    api.routeHistory(origin, dest)
      .then((data) => { if (active) setState({ key: routeKey, data, error: false }); })
      .catch(() => { if (active) setState({ key: routeKey, data: [], error: true }); });
    return () => { active = false; };
  }, [dest, origin, routeKey]);

  const loading = state.key !== routeKey;
  const data = loading ? [] : state.data;
  const error = !loading && state.error;

  const avg = data.length > 0 ? data.reduce((s, p) => s + p.on_time_rate, 0) / data.length : null;
  const minRate = data.length > 0 ? Math.min(...data.map((p) => p.on_time_rate)) : 0;
  const domainMin = Math.max(0, Math.floor(minRate * 10 - 1) / 10);
  const route = `${origin} → ${dest}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Tendencia de puntualidad — {route}
          </CardTitle>
          {avg !== null && (
            <span className={
              avg >= 0.75 ? "text-xs font-mono text-risk-low"
              : avg >= 0.6 ? "text-xs font-mono text-risk-medium"
              : "text-xs font-mono text-risk-high"
            }>
              Prom. {Math.round(avg * 100)}%
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : error || data.length === 0 ? (
          <p className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
            {error ? "No se pudo cargar el historial." : "Sin datos históricos para esta ruta aún."}
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <LineChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <YAxis
                tickLine={false} axisLine={false} tickMargin={8} fontSize={11}
                width={36} domain={[domainMin, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <ReferenceLine
                y={0.75} stroke="var(--color-on_time_rate)"
                strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value: "75%", position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(v) => typeof v === "number" ? `${Math.round(v * 100)}%` : String(v)} />}
              />
              <Line type="monotone" dataKey="on_time_rate" stroke="var(--color-on_time_rate)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
