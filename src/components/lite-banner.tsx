import { Info } from "lucide-react";

export function LiteBanner({ lastUpdated }: { lastUpdated?: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3 flex gap-3 items-start text-sm">
      <Info className="size-4 mt-0.5 shrink-0 text-primary" />
      <div className="space-y-0.5">
        <p className="font-medium">
          Predicciones en tiempo real de retrasos — Aeropuerto Hartsfield-Jackson Atlanta (ATL)
        </p>
        <p className="text-muted-foreground text-xs">
          OnTimeAI usa inteligencia artificial para estimar la probabilidad de retraso de cada vuelo
          con anticipación. Riesgo{" "}
          <span className="font-medium text-red-500 dark:text-red-400">Alto</span> significa más del
          35% de probabilidad de llegar con más de 15 minutos de demora.
          {lastUpdated ? ` Última actualización: ${lastUpdated}.` : ""}{" "}
          Las predicciones se actualizan cada 15 minutos.
        </p>
      </div>
    </div>
  );
}
