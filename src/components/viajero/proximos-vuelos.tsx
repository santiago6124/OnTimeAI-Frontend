import Link from "next/link";
import { Plane } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { fmtTime, toUTCDate, type Flight } from "@/lib/api";

/**
 * Las que todavía no salieron, ordenadas y recortadas a doce.
 *
 * Doce y no las 769 del día: esto no es la tabla de operaciones, es lo que
 * está por salir. Quien busca un vuelo puntual usa el buscador de arriba.
 *
 * Va fuera del componente a propósito: lee el reloj, y un componente que
 * cambia de resultado sin que cambien sus props no es puro. React lo marca,
 * y con razón.
 */
export function proximasSalidas(vuelos: Flight[], ahora: number): Flight[] {
  return vuelos
    .filter((v) => {
      if (v.actual_out_utc || v.actual_off_utc) return false;
      const salida = v.estimated_out_utc || v.scheduled_out_utc;
      return Boolean(salida) && toUTCDate(salida).getTime() > ahora;
    })
    .sort(
      (a, b) =>
        toUTCDate(a.estimated_out_utc || a.scheduled_out_utc).getTime() -
        toUTCDate(b.estimated_out_utc || b.scheduled_out_utc).getTime(),
    )
    .slice(0, 12);
}

/** La lista ya viene filtrada por `proximasSalidas`. */
export function ProximosVuelos({ vuelos: proximos }: { vuelos: Flight[] }) {
  if (proximos.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No hay salidas próximas en este momento.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Próximas salidas de Atlanta
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ul className="divide-y">
          {proximos.map((v) => {
            const salida = v.estimated_out_utc || v.scheduled_out_utc;
            const demorado =
              v.estimated_out_utc &&
              v.scheduled_out_utc &&
              toUTCDate(v.estimated_out_utc).getTime() >
                toUTCDate(v.scheduled_out_utc).getTime() + 60_000;
            return (
              <li key={v.fa_flight_id}>
                <Link
                  href={`/flights/${encodeURIComponent(v.fa_flight_id)}`}
                  className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-accent/50"
                >
                  <Plane className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {v.flight_number}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        hacia {v.destination}
                      </span>
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {fmtTime(salida)} UTC
                      {demorado ? (
                        <span className="ml-1 text-risk-medium">
                          · estimada, salía {fmtTime(v.scheduled_out_utc)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <RiskBadge risk={v.risk} />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
