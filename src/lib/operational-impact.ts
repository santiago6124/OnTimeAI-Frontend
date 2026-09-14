import { toUTCDate, type Flight } from "@/lib/api";

/**
 * Impacto operacional derivado de los vuelos activos (issue #6).
 *
 * Nota importante sobre `predicted_delay`: es binario (0/1), no minutos. El
 * modelo v9 es un clasificador sobre `arr_delay_min > 15`, así que no produce
 * una magnitud de demora y sumarlo daría un conteo de vuelos, no tiempo.
 *
 * Para llegar a minutos se combinan dos cantidades que sí son observables:
 *
 *   1. La cantidad esperada de demoras, como suma de las probabilidades de
 *      los vuelos que todavía no despegaron. Es la esperanza de una suma de
 *      Bernoullis, no una heurística.
 *   2. La demora mediana de los vuelos que ya aterrizaron demorados hoy,
 *      medida sobre los actuals del propio dataset.
 *
 * El producto es una estimación, y como tal se rotula en la UI. Se usa mediana
 * y no media porque la distribución de demoras tiene cola larga: un vuelo con
 * 6 horas de retraso desplaza la media y exagera el total.
 */

/** Umbral DOT/BTS: un vuelo está demorado si llega 15+ minutos tarde. */
const DELAY_THRESHOLD_MIN = 15;

/** Ventana en la que todavía se puede reorganizar puertas y tripulaciones. */
export const ACTION_WINDOW_MIN = 120;

export type OperationalImpact = {
  /** Vuelos con predicción activa que aún no despegaron. */
  notDeparted: number;
  /** Suma de probabilidades sobre esos vuelos: demoras esperadas. */
  expectedDelays: number;
  /** Demora mediana observada hoy entre los vuelos que llegaron tarde. */
  medianDelayMin: number | null;
  /** expectedDelays × medianDelayMin. Null si todavía no hay actuals. */
  anticipatedMinutes: number | null;
  /** Cuántos actuals sostienen la mediana. */
  actualsSampleSize: number;
  /** Riesgo alto, sin despegar, saliendo dentro de la ventana de acción. */
  actionableFlights: number;
};

function hasDeparted(f: Flight): boolean {
  return f.actual_out_utc !== null || f.actual_off_utc !== null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeOperationalImpact(
  flights: Flight[],
  now: number,
): OperationalImpact {
  const pending = flights.filter((f) => !hasDeparted(f));

  const expectedDelays = pending.reduce(
    (sum, f) => sum + (f.delay_probability ?? 0),
    0,
  );

  const observedDelays = flights
    .filter(
      (f) =>
        f.has_actual &&
        f.arr_delay_min !== null &&
        f.arr_delay_min > DELAY_THRESHOLD_MIN,
    )
    .map((f) => f.arr_delay_min as number);

  const medianDelayMin = median(observedDelays);

  const actionableFlights = pending.filter((f) => {
    if (f.risk !== "high") return false;
    const departure = f.estimated_out_utc || f.scheduled_out_utc;
    if (!departure) return false;
    const minutesAway = (toUTCDate(departure).getTime() - now) / 60_000;
    return minutesAway >= 0 && minutesAway <= ACTION_WINDOW_MIN;
  }).length;

  return {
    notDeparted: pending.length,
    expectedDelays,
    medianDelayMin,
    anticipatedMinutes:
      medianDelayMin === null ? null : expectedDelays * medianDelayMin,
    actualsSampleSize: observedDelays.length,
    actionableFlights,
  };
}

/** 2545 → "42 h 25 m". Los totales diarios en minutos crudos no se leen. */
export function formatMinutes(total: number): string {
  const rounded = Math.round(total);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, "0")} m`;
}
