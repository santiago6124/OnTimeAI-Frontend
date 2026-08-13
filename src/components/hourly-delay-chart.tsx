"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type HourlyBucket } from "@/lib/api";

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

type ChartItem = {
  hour: string;
  high: number;
  medium: number;
  low: number;
  total: number;
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{label} UTC — {total} vuelos</p>
      {[...payload].reverse().map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-medium">{p.value}</span>
        </div>
      ))}
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

  const chartData: ChartItem[] = data.map((b) => ({
    hour:   b.hour,
    high:   b.high_risk,
    medium: b.medium_risk ?? (b.total - b.high_risk),
    low:    b.low_risk ?? 0,
    total:  b.total,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Vuelos por hora — ATL
          </CardTitle>
          {!loading && data.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-risk-low" />
                Bajo <span className="text-[10px] opacity-60">(&lt;15%)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-risk-medium" />
                Medio <span className="text-[10px] opacity-60">(15–35%)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-risk-high" />
                Alto <span className="text-[10px] opacity-60">(&gt;35%)</span>
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
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={18} barGap={0}>
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
                width={28}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Bar dataKey="low"    name="Bajo"  stackId="a" fill="var(--color-risk-low)"    radius={[0,0,0,0]} />
              <Bar dataKey="medium" name="Medio" stackId="a" fill="var(--color-risk-medium)" radius={[0,0,0,0]} />
              <Bar dataKey="high"   name="Alto"  stackId="a" fill="var(--color-risk-high)"   radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
