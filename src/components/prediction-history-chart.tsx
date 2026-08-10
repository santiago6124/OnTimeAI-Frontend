"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { PredictionPoint } from "@/lib/api";

function asUTC(utc: string): Date {
  return new Date(/[Z+]/.test(utc) ? utc : utc + "Z");
}

function fmtAxisTime(utc: string) {
  const d = asUTC(utc);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function fmtTooltipTime(utc: string) {
  const d = asUTC(utc);
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
  selectedAt,
  onSelect,
}: {
  history: PredictionPoint[];
  arrDelayMin?: number | null;
  selectedAt?: string;
  onSelect?: (predictedAt: string) => void;
}) {
  const hasActual = arrDelayMin !== null && arrDelayMin !== undefined;
  const actuallyDelayed = hasActual && arrDelayMin! > 15;

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Evolución de predicciones</CardTitle>
          <CardDescription>Historial de ciclos de 30 min</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin historial de predicciones aún.
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = history.map((p) => ({
    predictedAt: p.predicted_at_utc,
    time: fmtAxisTime(p.predicted_at_utc),
    fullTime: fmtTooltipTime(p.predicted_at_utc),
    proba: Math.round(p.delay_probability * 100),
  }));

  const latestProba = data[data.length - 1].proba;
  const color = riskColor(latestProba);

  const header = (
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
        {history.length} {history.length === 1 ? "ciclo registrado" : "ciclos registrados"} · actualización cada 15 min
      </CardDescription>
    </CardHeader>
  );

  if (data.length === 1) {
    return (
      <Card>
        {header}
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 py-6">
            <div className="font-mono text-4xl font-bold" style={{ color }}>
              {latestProba}%
            </div>
            <div className="text-xs text-muted-foreground">{data[0].fullTime}</div>
            <div className="text-[11px] text-muted-foreground">Primer ciclo — se mostrará evolución en el siguiente</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={data} margin={{ top: 8, right: 52, bottom: 0, left: 0 }}>
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
              strokeWidth={1.5}
              strokeOpacity={0.9}
              label={{ value: "Alto 35%", position: "insideTopRight", fontSize: 10, fill: "var(--color-risk-high)", dy: -6 }}
            />
            <ReferenceLine
              y={15}
              stroke="var(--color-risk-medium)"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              strokeOpacity={0.9}
              label={{ value: "Medio 15%", position: "insideTopRight", fontSize: 10, fill: "var(--color-risk-medium)", dy: -6 }}
            />
            <Area
              type="linear"
              dataKey="proba"
              stroke={color}
              strokeWidth={2}
              fill="url(#probaGrad)"
              dot={(props: HistoryDotProps) => (
                <HistoryDot
                  {...props}
                  selected={props.payload?.predictedAt === selectedAt}
                  onSelect={onSelect}
                />
              )}
              activeDot={{ r: 5, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label="Ciclos de predicción disponibles"
        >
          {data.map((cycle, index) => (
            <button
              key={cycle.predictedAt}
              type="button"
              aria-pressed={cycle.predictedAt === selectedAt}
              onClick={() => onSelect?.(cycle.predictedAt)}
              className={`min-w-24 rounded-md border px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                cycle.predictedAt === selectedAt
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              <span className="block text-[10px] text-muted-foreground">
                Ciclo {index + 1}
              </span>
              <span className="block font-mono font-semibold" style={{ color: riskColor(cycle.proba) }}>
                {cycle.proba}%
              </span>
              <span className="block text-[10px] text-muted-foreground">{cycle.time} UTC</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Actualización cada 15 min · Umbrales:{" "}
          <span className="text-risk-medium">15% medio</span>{" · "}
          <span className="text-risk-high">35% alto</span>
        </p>
      </CardContent>
    </Card>
  );
}

type ChartDatum = {
  predictedAt: string;
  proba: number;
};

type HistoryDotProps = {
  cx?: number;
  cy?: number;
  payload?: ChartDatum;
  selected?: boolean;
  onSelect?: (predictedAt: string) => void;
};

function HistoryDot({ cx, cy, payload, selected, onSelect }: HistoryDotProps) {
  if (cx === undefined || cy === undefined || !payload) return <g />;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={selected ? 5 : 3.5}
      fill={riskColor(payload.proba)}
      stroke="hsl(var(--background))"
      strokeWidth={selected ? 2.5 : 1.5}
      className="cursor-pointer"
      onClick={() => onSelect?.(payload.predictedAt)}
    />
  );
}
