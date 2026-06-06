import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Clock, Plane, TriangleAlert, TrendingUp } from "lucide-react";
import { api, fmtProba, fmtTime } from "@/lib/api";
import { cn } from "@/lib/utils";

type MetricProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "danger";
};

function MetricCard({
  label,
  value,
  delta,
  trend = "neutral",
  icon: Icon,
  tone = "default",
}: MetricProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          <Icon
            className={cn(
              "size-4",
              tone === "warning" && "text-risk-medium",
              tone === "danger" && "text-risk-high",
              tone === "default" && "text-muted-foreground",
            )}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="font-mono text-2xl font-semibold tracking-tight">
          {value}
        </div>
        {delta ? (
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              trend === "up" && "text-risk-high",
              trend === "down" && "text-risk-low",
              trend === "neutral" && "text-muted-foreground",
            )}
          >
            {trend === "up" ? (
              <ArrowUpRight className="size-3 shrink-0" />
            ) : trend === "down" ? (
              <ArrowDownRight className="size-3 shrink-0" />
            ) : null}
            {delta}
          </div>
        ) : null}
        {/* Accent bar based on tone */}
        <div
          className={cn(
            "absolute bottom-0 left-0 h-0.5 w-full",
            tone === "danger" && "bg-risk-high/40",
            tone === "warning" && "bg-risk-medium/40",
            tone === "default" && "bg-primary/20",
          )}
        />
      </CardContent>
    </Card>
  );
}

export function MetricCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              <div className="size-4 animate-pulse rounded bg-muted" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export async function MetricCards() {
  let m;
  try {
    m = await api.summary();
  } catch {
    m = null;
  }

  if (!m) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Vuelos del día", icon: Plane },
          { label: "Prob. retraso promedio", icon: TrendingUp },
          { label: "Puntualidad estimada", icon: Clock },
          { label: "Vuelos riesgo alto", icon: TriangleAlert },
        ].map(({ label, icon: Icon }) => (
          <Card key={label} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>{label}</span>
                <Icon className="size-4" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="font-mono text-2xl font-semibold tracking-tight text-muted-foreground">—</div>
              <div className="text-xs text-muted-foreground">Sin datos disponibles</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const total  = m.total_flights ?? 0;
  const onTime = total > 0 ? 1 - (m.avg_delay_probability ?? 0) : 0;
  const posRate = fmtProba(m.avg_delay_probability ?? 0);
  const high   = m.high_risk ?? 0;
  const med    = m.medium_risk ?? 0;
  const low    = m.low_risk ?? 0;
  const lastTick = m.last_tick_utc ? fmtTime(m.last_tick_utc) + " UTC" : "—";

  return (
    <div className="space-y-3">
    <p className="text-[11px] font-mono text-muted-foreground">
      Última predicción: {lastTick}
    </p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Vuelos del día"
        value={String(total)}
        delta={`modelo ${m.model_version}`}
        trend="neutral"
        icon={Plane}
      />
      <MetricCard
        label="Prob. retraso promedio"
        value={posRate}
        delta={`${high} alto · ${med} medio · ${low} bajo`}
        trend={onTime > 0.85 ? "down" : "up"}
        icon={TrendingUp}
      />
      <MetricCard
        label="Puntualidad estimada"
        value={`${Math.round(onTime * 100)}%`}
        delta={onTime >= 0.85 ? "dentro de rango" : "por debajo del objetivo"}
        trend={onTime >= 0.85 ? "down" : "up"}
        icon={Clock}
        tone={onTime < 0.80 ? "warning" : "default"}
      />
      <MetricCard
        label="Vuelos riesgo alto"
        value={String(high)}
        delta={`${med} medios · ${low} bajos`}
        icon={TriangleAlert}
        tone={high > 10 ? "danger" : "warning"}
      />
    </div>
    </div>
  );
}
