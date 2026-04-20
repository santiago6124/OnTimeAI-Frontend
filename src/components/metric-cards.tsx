import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Clock, Plane, TriangleAlert, TrendingUp } from "lucide-react";
import { MOCK_METRICS } from "@/lib/mock-data";
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

export function MetricCards() {
  const m = MOCK_METRICS;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Vuelos del día"
        value={String(m.totalFlights)}
        delta="+3 vs ayer"
        trend="up"
        icon={Plane}
      />
      <MetricCard
        label="Puntualidad"
        value={`${Math.round(m.onTimeRate * 100)}%`}
        delta="-4 pts vs promedio"
        trend="down"
        icon={TrendingUp}
      />
      <MetricCard
        label="Retraso promedio"
        value={`${m.avgDelayMinutes.toFixed(1)} min`}
        delta="+2.1 min"
        trend="up"
        icon={Clock}
        tone="warning"
      />
      <MetricCard
        label="Vuelos riesgo alto"
        value={String(m.highRiskCount)}
        delta={`${m.mediumRiskCount} medios · ${m.lowRiskCount} bajos`}
        icon={TriangleAlert}
        tone="danger"
      />
    </div>
  );
}
