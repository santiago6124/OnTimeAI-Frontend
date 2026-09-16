/**
 * Lectura de la serie diaria de calidad del modelo.
 *
 * El problema central de esta serie no es graficarla, es no mentir con ella.
 * Un día en que el pipeline corrió a medias deja veinte vuelos aterrizados en
 * vez de quinientos, y el AUC de veinte vuelos es ruido: la serie real tiene un
 * 2026-08-18 con AUC 0.06 sobre 18 vuelos, que dibujado al lado de los demás
 * parece el día que el modelo se rompió. No se rompió nada; no había con qué
 * medir.
 *
 * Por eso todo lo de acá separa los días que pueden decir algo de los que no, y
 * el promedio móvil se calcula solo sobre los primeros.
 */

import type { ModelHistoryPoint } from "@/lib/api";

/**
 * Vuelos aterrizados mínimos para que un día cuente.
 *
 * Con ~20% de retrasos reales, 200 vuelos son unos 40 positivos. Por debajo de
 * ahí el AUC se mueve décimas por un puñado de casos y la serie cuenta una
 * historia que no pasó. Un día normal en ATL trae ~520.
 */
export const MINIMO_CONFIABLE = 200;

/** Ventana del promedio móvil: una semana absorbe el ciclo semanal del tráfico. */
export const VENTANA_DIAS = 7;

/** AUC del modelo sobre el set de test, para ver contra qué se compara el vivo. */
export const AUC_TEST = 0.847;

/** Campos numéricos de la serie que se pueden graficar y promediar. */
export type Metrica = "auc" | "ece" | "brier" | "precision" | "recall";

export function esConfiable(punto: ModelHistoryPoint): boolean {
  return punto.n_flights >= MINIMO_CONFIABLE;
}

/**
 * Promedio móvil hacia atrás, saltando los días que no cuentan.
 *
 * Saltar no es lo mismo que tratarlos como cero: un día sin datos no arrastra
 * la curva hacia abajo, simplemente no participa. Devuelve `null` mientras no
 * haya al menos la mitad de la ventana con días válidos, para no publicar un
 * promedio de dos días como si fuera de siete.
 */
export function promedioMovil(
  puntos: ModelHistoryPoint[],
  metrica: Metrica,
  ventana: number = VENTANA_DIAS,
): (number | null)[] {
  return puntos.map((_, i) => {
    const desde = Math.max(0, i - ventana + 1);
    const valores = puntos
      .slice(desde, i + 1)
      .filter(esConfiable)
      .map((p) => p[metrica])
      .filter((v): v is number => v !== null);

    if (valores.length < Math.ceil(ventana / 2)) return null;
    return valores.reduce((s, v) => s + v, 0) / valores.length;
  });
}

export type Comparacion = {
  /** Promedio de la ventana más reciente. */
  actual: number;
  /** Promedio de la ventana inmediatamente anterior, si alcanzan los días. */
  previo: number | null;
  /** `actual - previo`, en las unidades de la métrica. */
  delta: number | null;
  /** Días confiables que entraron en `actual`. */
  dias: number;
};

/**
 * Compara la última ventana contra la anterior.
 *
 * Devuelve `null` si no hay ni un día confiable con esa métrica: es distinto de
 * un cero y la pantalla tiene que poder decir "todavía no se sabe".
 */
export function compararPeriodos(
  puntos: ModelHistoryPoint[],
  metrica: Metrica,
  ventana: number = VENTANA_DIAS,
): Comparacion | null {
  const utiles = puntos.filter(
    (p) => esConfiable(p) && p[metrica] !== null,
  );
  if (utiles.length === 0) return null;

  const valores = utiles.map((p) => p[metrica] as number);
  const recientes = valores.slice(-ventana);
  const anteriores = valores.slice(-ventana * 2, -ventana);

  const media = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const actual = media(recientes);
  // Solo se compara contra una ventana completa. Media ventana contra una
  // entera produce un "empeoró" que es un artefacto de cuántos días había.
  const previo = anteriores.length === ventana ? media(anteriores) : null;

  return {
    actual,
    previo,
    delta: previo === null ? null : actual - previo,
    dias: recientes.length,
  };
}

/**
 * Hacia dónde mejora cada métrica.
 *
 * El AUC sube cuando el modelo ordena mejor; el ECE y el Brier bajan cuando los
 * números son más honestos. Sin esto, una flecha verde hacia arriba en el ECE
 * diría exactamente lo contrario de lo que pasó.
 */
export const MEJORA_AL_SUBIR: Record<Metrica, boolean> = {
  auc: true,
  precision: true,
  recall: true,
  ece: false,
  brier: false,
};

export type Tendencia = "mejor" | "peor" | "igual" | "sin-datos";

/**
 * Clasifica un cambio, con una zona muerta.
 *
 * Sin el umbral, cualquier movimiento de la cuarta decimal pintaría una flecha
 * de colores y la pantalla parecería llena de noticias todos los días.
 */
export function tendencia(
  metrica: Metrica,
  delta: number | null,
  umbral = 0.005,
): Tendencia {
  if (delta === null) return "sin-datos";
  if (Math.abs(delta) < umbral) return "igual";
  const sube = delta > 0;
  return sube === MEJORA_AL_SUBIR[metrica] ? "mejor" : "peor";
}

/** Períodos que la pantalla ofrece, en semanas. */
export const PERIODOS_SEMANAS = [4, 8, 12] as const;
export const PERIODO_DEFECTO = 8;

/**
 * Lee el período de la URL contra una lista cerrada.
 *
 * Cerrada y no un rango: el valor termina en la query del backend, y aceptar
 * cualquier número dejaría que un enlace pidiera diez años de serie. Lo que no
 * esté en la lista cae al valor por defecto en vez de fallar — un enlace viejo
 * o mal tipeado tiene que seguir mostrando la página.
 */
export function semanasPedidas(valor: string | string[] | undefined): number {
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  const n = Number(crudo);
  return (PERIODOS_SEMANAS as readonly number[]).includes(n)
    ? n
    : PERIODO_DEFECTO;
}

/** Cuántos días de la serie no alcanzan el mínimo, para poder decirlo. */
export function diasDescartados(puntos: ModelHistoryPoint[]): number {
  return puntos.filter((p) => !esConfiable(p)).length;
}

/**
 * Los puntos donde cambió el artefacto en uso.
 *
 * Un salto en la curva que coincide con un cambio de modelo no es deriva, es el
 * modelo nuevo. Marcarlos evita leer una cosa por la otra.
 */
export function cambiosDeModelo(
  puntos: ModelHistoryPoint[],
): { day: string; from: string; to: string }[] {
  const cambios: { day: string; from: string; to: string }[] = [];
  for (let i = 1; i < puntos.length; i++) {
    const previo = puntos[i - 1].model_version;
    const actual = puntos[i].model_version;
    if (previo && actual && previo !== actual) {
      cambios.push({ day: puntos[i].day, from: previo, to: actual });
    }
  }
  return cambios;
}
