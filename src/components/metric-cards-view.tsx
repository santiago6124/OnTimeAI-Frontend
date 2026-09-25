/**
 * Render de las tarjetas de métricas, sin fetch.
 *
 * Está separado del componente que trae los datos porque las dos
 * plataformas los traen distinto: en la web los pide un Server Component
 * durante el render, y en el bundle nativo los pide el cliente al montar,
 * porque ahí no hay servidor y un fetch en build time congelaría el
 * dashboard en la foto del día en que se compiló.
 *
 * Lo que se ve en pantalla es este archivo, uno solo, para las dos.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Plane, TrendingUp } from "lucide-react";
import { fmtProba, fmtTime, type MetricsSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type MetricProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
};

function MetricCard({
  label,
  value,
  delta,
  trend = "neutral",
  icon: Icon,
}: MetricProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span>{label}</span>
          <Icon className="size-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="text-3xl font-semibold tabular-nums tracking-tight">
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
      </CardContent>
    </Card>
  );
}

export function MetricCardsSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              <div className="size-4 animate-pulse rounded bg-muted" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="h-9 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export function MetricCardsView({ data: m }: { data: MetricsSummary | null }) {
  if (!m) {
    return (
      <>
        {[
          { label: "Vuelos del día", icon: Plane },
          { label: "Prob. retraso promedio", icon: TrendingUp },
        ].map(({ label, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>{label}</span>
                <Icon className="size-4" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="text-3xl font-semibold tabular-nums tracking-tight text-muted-foreground">—</div>
              <div className="text-xs text-muted-foreground">Sin datos disponibles</div>
            </CardContent>
          </Card>
        ))}
      </>
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
    <>
      <MetricCard
        label="Vuelos del día"
        value={String(total)}
        delta={`Última predicción: ${lastTick}`}
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
    </>
  );
}
