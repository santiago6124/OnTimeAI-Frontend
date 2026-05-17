import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Clock, Plane, TriangleAlert, TrendingUp } from "lucide-react";
import { api, fmtProba } from "@/lib/api";
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
      <CardContent className="space-y-1">
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
              <ArrowUpRight className="size-3" />
            ) : trend === "down" ? (
              <ArrowDownRight className="size-3" />
            ) : null}
            {delta}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export async function MetricCards() {
  let m;
  try {
    m = await api.summary();
  } catch {
    m = null;
  }

  const total   = m?.total_flights ?? 0;
  const onTime  = total > 0 ? 1 - (m?.avg_delay_probability ?? 0) : 0;
  const posRate = fmtProba(m?.avg_delay_probability ?? 0);
  const high    = m?.high_risk ?? 0;
  const med     = m?.medium_risk ?? 0;
  const low     = m?.low_risk ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Vuelos del día"
        value={String(total)}
        delta={m ? `modelo ${m.model_version}` : "sin datos"}
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
  );
}
