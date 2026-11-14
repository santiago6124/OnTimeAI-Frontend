import { toUTCDate, type Flight } from "@/lib/api";

type Horarios = Pick<
  Flight,
  "scheduled_out_utc" | "estimated_out_utc" | "scheduled_in_utc" | "estimated_in_utc"
>;

/** Un minuto de tolerancia: corrimientos menores no se le muestran al viajero. */
const TOLERANCIA_MS = 60_000;

function ms(utc: string | null | undefined): number | null {
  if (!utc) return null;
  const t = toUTCDate(utc).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * La salida estimada, solo si el vuelo se corrió más de un minuto.
 *
 * Si la estimación coincide con lo programado, mostrarla como "estimada" no
 * aporta nada y obliga a leer dos horarios iguales.
 */
export function salidaEstimada(f: Horarios): string | null {
  const prog = ms(f.scheduled_out_utc);
  const est = ms(f.estimated_out_utc);
  if (prog === null || est === null || est <= prog + TOLERANCIA_MS) return null;
  return f.estimated_out_utc;
}

/**
 * La llegada estimada y si es una proyección.
 *
 * La fuente no siempre trae `estimated_in_utc`: es común que haya hora de
 * salida estimada y no de llegada. Antes se caía a la llegada programada, y un
 * vuelo demorado mostraba que llegaba antes de salir (DL2250 del 12/11: sale
 * 22:22, llega 21:17). Sin estimación de llegada, se proyecta la programada con
 * la misma demora de la salida, y se avisa que es una proyección.
 */
export function llegadaEstimada(f: Horarios): { hora: string | null; proyectada: boolean } {
  if (ms(f.estimated_in_utc) !== null) return { hora: f.estimated_in_utc, proyectada: false };

  const salida = salidaEstimada(f);
  const progIn = ms(f.scheduled_in_utc);
  const progOut = ms(f.scheduled_out_utc);
  if (salida === null || progIn === null || progOut === null) {
    return { hora: null, proyectada: false };
  }

  const demora = (ms(salida) as number) - progOut;
  return { hora: new Date(progIn + demora).toISOString(), proyectada: true };
}
