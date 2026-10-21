/**
 * La geometría de la cortina de pista, en un solo lugar.
 *
 * El componente, las posiciones de reposo para "reducir movimiento" y el
 * polígono del asfalto salen todos de esta curva. Si vivieran por separado
 * se desalinearían: las luces de borde quedarían flotando sobre el asfalto en
 * vez de apoyadas en el borde, que fue justo el primer error de esta pantalla.
 *
 * ## Por qué no es perspectiva real
 *
 * Una proyección de cámara honesta da `y = horizonte + k/Z`, y con la cámara
 * a la altura de una cabina casi todo el recorrido visible pasa en el último
 * 10% del trayecto: tres segundos quietos y un borrón. Eso es exactamente lo
 * que se ve desde un avión, y es exactamente lo que no sirve para una espera
 * de dos segundos.
 *
 * Así que la curva es cúbica en vez de hiperbólica: misma lectura de
 * profundidad —lo lejano chico y lento, lo cercano grande y rápido— con el
 * movimiento repartido de forma que siempre haya algo cruzando la pantalla.
 *
 * El precio es que el borde del asfalto, que en una proyección real sería una
 * recta, acá es una curva suave. Nadie lo nota; que las luces no coincidan con
 * el borde se nota al instante.
 */

/** Dónde está el horizonte, en porcentaje de la altura de la pantalla. */
export const HORIZONTE_PCT = 54;

/** Cuánto baja un tramo desde el horizonte al salir de cuadro, en vh. */
const RECORRIDO_VH = 50;

/** Escala mínima: a qué tamaño aparece un tramo en el punto de fuga. */
const ESCALA_MINIMA = 0.03;

/** Separación lateral de las luces de borde a escala 1, en vw. */
export const BORDE_VW = 33;

/** El asfalto asoma un poco por fuera de las luces, como en una pista real. */
const ASFALTO_VW = 36;

/** Lo que tarda un tramo en recorrer la pista entera. */
export const CICLO_MS = 2200;

/** Cuántos tramos hay a la vista. */
export const TRAMOS = 8;

export type PuntoDePista = {
  /** Cuánto baja desde el horizonte, en vh. */
  y: number;
  /** Factor de escala del tramo. */
  escala: number;
};

/**
 * La curva. `avance` va de 0 (punto de fuga) a 1 (saliendo de cuadro).
 *
 * Los exponentes no son iguales a propósito: la posición crece más rápido que
 * el tamaño, que es lo que hace que lo cercano se sienta cercano sin que los
 * tramos del fondo queden invisiblemente chicos.
 */
export function puntoDePista(avance: number): PuntoDePista {
  const a = Math.min(Math.max(avance, 0), 1);
  return {
    y: RECORRIDO_VH * a ** 3,
    escala: ESCALA_MINIMA + (1 - ESCALA_MINIMA) * a ** 2.8,
  };
}

export type Tramo = {
  /** Para la key de React. */
  indice: number;
  /** Posición de reposo, la que se usa con "reducir movimiento" activado. */
  y: number;
  escala: number;
  /**
   * Retardo NEGATIVO: arranca el ciclo por la mitad. Sin esto los dos primeros
   * segundos son tramos goteando de uno en uno desde el horizonte, y la espera
   * entera se va en poblar la pista.
   */
  retrasoMs: number;
};

/** Los tramos, repartidos a lo largo del ciclo. */
export function tramosDePista(cantidad = TRAMOS): Tramo[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const avance = (i + 1) / cantidad;
    const { y, escala } = puntoDePista(avance);
    return { indice: i, y, escala, retrasoMs: -Math.round(CICLO_MS * avance) };
  });
}

/**
 * El polígono del asfalto, en coordenadas del `viewBox` 100 × 100.
 *
 * Se muestrea la misma curva que mueve los tramos, así que el borde pasa por
 * donde pasan las luces. Con `preserveAspectRatio="none"` una unidad de x es
 * 1vw y una de y es 1vh, que es lo que deja comparar con `BORDE_VW`.
 */
export function bordesDelAsfalto(muestras = 12): string {
  const derecho: string[] = [];
  const izquierdo: string[] = [];
  for (let i = 0; i <= muestras; i++) {
    const { y, escala } = puntoDePista(i / muestras);
    const alto = HORIZONTE_PCT + y;
    const ancho = ASFALTO_VW * escala;
    derecho.push(`${(50 + ancho).toFixed(2)},${alto.toFixed(2)}`);
    izquierdo.push(`${(50 - ancho).toFixed(2)},${alto.toFixed(2)}`);
  }
  return [...derecho, ...izquierdo.reverse()].join(" ");
}

/** Los destellos secuenciados del eje, los que suben hacia el umbral. */
export const DESTELLOS = Array.from({ length: 7 }, (_, i) => {
  const avance = 0.05 + i * 0.042;
  const { y, escala } = puntoDePista(avance);
  return {
    indice: i,
    y,
    escala,
    // Corre de lejos a cerca: el "conejo" de un ALSF-2 visto desde el aire.
    retrasoMs: Math.round(i * 55),
  };
});
