"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { PredictionPoint } from "@/lib/api";

function fmtAxisTime(utc: string) {
  const d = new Date(utc);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function fmtTooltipTime(utc: string) {
  const d = new Date(utc);
  const date = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date} ${time} UTC`;
}

function riskColor(proba: number) {
  if (proba >= 35) return "var(--color-risk-high)";
  if (proba >= 15) return "var(--color-risk-medium)";
  return "var(--color-risk-low)";
}

export function PredictionHistoryChart({
  history,
  arrDelayMin,
}: {
  history: PredictionPoint[];
  arrDelayMin?: number | null;
}) {
  const hasActual = arrDelayMin !== null && arrDelayMin !== undefined;
  const actuallyDelayed = hasActual && arrDelayMin! > 15;

  if (history.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Evolución de predicciones</CardTitle>
          <CardDescription>Historial de ciclos de 30 min</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {history.length === 0
              ? "Sin historial de predicciones aún."
              : "Se necesitan al menos 2 ciclos para mostrar evolución."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = history.map((p) => ({
    time: fmtAxisTime(p.predicted_at_utc),
    fullTime: fmtTooltipTime(p.predicted_at_utc),
    proba: Math.round(p.delay_probability * 100),
  }));

  const latestProba = data[data.length - 1].proba;
  const color = riskColor(latestProba);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Evolución de predicciones
          {hasActual && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              actuallyDelayed
                ? "bg-risk-high/10 text-risk-high"
                : "bg-risk-low/10 text-risk-low"
            }`}>
              {actuallyDelayed
                ? `Resultado: demorado (+${Math.round(arrDelayMin!)} min)`
                : "Resultado: a tiempo"}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {history.length} ciclos registrados · actualización cada 30 min
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="probaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as { fullTime: string; proba: number };
                return (
                  <div className="rounded border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="text-muted-foreground">{d.fullTime}</p>
                    <p className="mt-0.5 font-semibold">{d.proba}% prob. retraso</p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={35}
              stroke="var(--color-risk-high)"
              strokeDasharray="4 2"
              strokeWidth={1}
              strokeOpacity={0.6}
            />
            <ReferenceLine
              y={15}
              stroke="var(--color-risk-medium)"
              strokeDasharray="4 2"
              strokeWidth={1}
              strokeOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="proba"
              stroke={color}
              strokeWidth={2}
              fill="url(#probaGrad)"
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Líneas de referencia: 15% (riesgo medio) · 35% (riesgo alto)
        </p>
      </CardContent>
    </Card>
  );
}
