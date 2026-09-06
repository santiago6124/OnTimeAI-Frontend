/**
 * Render del impacto operacional, sin fetch. Ver `metric-cards-view.tsx`
 * para el porqué de la separación entre vista y carga de datos.
 */
import { Info, Timer, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ACTION_WINDOW_MIN,
  formatMinutes,
  type OperationalImpact,
} from "@/lib/operational-impact";

export function OperationalImpactSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-44 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


export function OperationalImpactCardsView({
  impact,
}: {
  impact: OperationalImpact | null;
}) {
  if (!impact) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ImpactCard
        icon={<Timer className="size-4" />}
        label="Demora anticipada hoy"
        value={
          impact.anticipatedMinutes === null
            ? "—"
            : formatMinutes(impact.anticipatedMinutes)
        }
        detail={
          impact.anticipatedMinutes === null
            ? "Sin vuelos aterrizados todavía para estimar la magnitud"
            : `${impact.expectedDelays.toFixed(0)} demoras esperadas sobre ${impact.notDeparted} vuelos sin despegar`
        }
        help={
          impact.anticipatedMinutes === null
            ? "La estimación necesita vuelos ya aterrizados del día para anclar la magnitud de la demora."
            : `Estimación. El modelo clasifica si un vuelo se demora más de 15 minutos, no cuántos: no predice magnitud. Este total combina las demoras esperadas (suma de probabilidades de los vuelos que aún no despegaron) con la demora mediana observada hoy entre los ${impact.actualsSampleSize} vuelos que ya llegaron tarde (${impact.medianDelayMin?.toFixed(0)} min). Es el tiempo que operaciones puede intentar mitigar antes del despegue.`
        }
      />

      <ImpactCard
        icon={<Wrench className="size-4" />}
        label="Vuelos en ventana de acción"
        value={String(impact.actionableFlights)}
        detail={`Riesgo alto saliendo dentro de ${ACTION_WINDOW_MIN / 60} h`}
        help={`Vuelos de riesgo alto que todavía no despegaron y salen dentro de las próximas ${ACTION_WINDOW_MIN / 60} horas: el subconjunto donde aún se puede reasignar puerta, tripulación o posición en la secuencia.`}
      />
    </div>
  );
}

function ImpactCard({
  icon,
  label,
  value,
  detail,
  help,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  help: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {label}
            <Tooltip>
              <TooltipTrigger
                aria-label={`Cómo se calcula: ${label}`}
                className="text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                <Info className="size-3" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-relaxed">
                {help}
              </TooltipContent>
            </Tooltip>
          </span>
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}
