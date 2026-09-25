/**
 * Dónde acierta el modelo y dónde falla, por aerolínea o por hora del día.
 *
 * La columna que ordena es la de vuelos, no la de accuracy. Una aerolínea con
 * cuatro vuelos y 100% de aciertos encabezaría cualquier ranking por accuracy y
 * no diría nada: las filas flojas de muestra se marcan y van al final, igual que
 * los días flojos quedan fuera del promedio en los gráficos.
 *
 * Tampoco se ordena por accuracy porque es engañosa sola. Con ~20% de retrasos
 * reales, un modelo que no marque nunca nada acierta el 80%. Por eso la tabla
 * muestra al lado la tasa real de retraso: sin ella, 0.80 parece bueno.
 */

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { BreakdownRow } from "@/lib/api";

/** Vuelos mínimos para que una fila se lea sin advertencia. */
const MINIMO_FILA = 100;

function Num({ v, pct = true }: { v: number | null; pct?: boolean }) {
  if (v === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="tabular-nums">
      {pct ? `${Math.round(v * 100)}%` : v.toFixed(3)}
    </span>
  );
}

export function MetricBreakdownTable({
  filas,
  etiquetaClave,
  formatearClave,
  maximo = 12,
}: {
  filas: BreakdownRow[];
  etiquetaClave: string;
  formatearClave?: (key: string) => string;
  maximo?: number;
}) {
  if (filas.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Todavía no hay datos agregados para este corte.
      </p>
    );
  }

  const mostradas = filas.slice(0, maximo);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{etiquetaClave}</TableHead>
            <TableHead className="text-right">Vuelos</TableHead>
            <TableHead className="text-right">Retraso real</TableHead>
            <TableHead className="text-right">Accuracy</TableHead>
            <TableHead className="text-right">Precisión</TableHead>
            <TableHead className="text-right">Recall</TableHead>
            <TableHead className="text-right">AUC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mostradas.map((f) => {
            const flaca = f.n_flights < MINIMO_FILA;
            return (
              <TableRow key={f.key} className={flaca ? "text-muted-foreground" : ""}>
                <TableCell className="font-medium">
                  {formatearClave ? formatearClave(f.key) : f.key}
                  {flaca && (
                    <span className="ml-2 text-[11px] font-normal">
                      muestra chica
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {f.n_flights}
                </TableCell>
                <TableCell className="text-right">
                  <Num v={f.actual_delay_rate} />
                </TableCell>
                <TableCell className="text-right">
                  <Num v={f.accuracy} />
                </TableCell>
                <TableCell className="text-right">
                  <Num v={f.precision} />
                </TableCell>
                <TableCell className="text-right">
                  <Num v={f.recall} />
                </TableCell>
                <TableCell className="text-right">
                  <Num v={f.auc} pct={false} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {filas.length > maximo && (
        <p className="pt-2 text-xs text-muted-foreground">
          Se muestran las {maximo} con más vuelos, de {filas.length}.
        </p>
      )}
    </div>
  );
}
