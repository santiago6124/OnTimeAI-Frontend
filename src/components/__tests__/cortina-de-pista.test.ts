/**
 * La geometría de la cortina de pista, y sobre todo las dos formas en que ya
 * se rompió una pantalla de carga en este repo.
 *
 * 1. **La curva vive en dos idiomas.** El asfalto se dibuja desde TypeScript
 *    y los tramos corren desde un `@keyframes` de CSS. Son la misma curva
 *    escrita dos veces, y cuando se desalinean las luces de borde quedan
 *    flotando sobre el asfalto en vez de apoyadas en el borde. La prueba lee
 *    el CSS de verdad y lo compara contra la función.
 *
 * 2. **Movimiento reducido deja la pista vacía.** Sin animación los tramos se
 *    quedan donde los pone el fotograma 0%, que es el punto de fuga: ocho
 *    elementos invisibles apilados. De ahí las posiciones de reposo, y de ahí
 *    que se prueben. La cortina de nubes tuvo exactamente este error.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BORDE_VW,
  CICLO_MS,
  DESTELLOS,
  bordesDelAsfalto,
  puntoDePista,
  tramosDePista,
} from "@/lib/perspectiva-pista";

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Los fotogramas de `corre-tramo`, leídos del CSS que se despliega. */
function fotogramasDelCss(): { pct: number; y: number; escala: number }[] {
  const bloque = /@keyframes corre-tramo\s*\{([\s\S]*?)\n\}/.exec(CSS);
  if (!bloque) throw new Error("No se encontró @keyframes corre-tramo en globals.css");
  const paradas = [
    ...bloque[1].matchAll(
      /(\d+)%\s*\{\s*transform:\s*translateY\(([-\d.]+)vh\)\s*scale\(([\d.]+)\)/g,
    ),
  ];
  return paradas.map((m) => ({
    pct: Number(m[1]),
    y: Number(m[2]),
    escala: Number(m[3]),
  }));
}

describe("curva de perspectiva", () => {
  it("empieza en el punto de fuga y termina fuera de cuadro", () => {
    expect(puntoDePista(0)).toEqual({ y: 0, escala: 0.03 });
    const final = puntoDePista(1);
    expect(final.y).toBe(50);
    expect(final.escala).toBeCloseTo(1, 6);
  });

  it("crece de forma monótona: nada retrocede ni se encoge al acercarse", () => {
    let anterior = puntoDePista(0);
    for (let a = 0.05; a <= 1.0001; a += 0.05) {
      const actual = puntoDePista(a);
      expect(actual.y).toBeGreaterThan(anterior.y);
      expect(actual.escala).toBeGreaterThan(anterior.escala);
      anterior = actual;
    }
  });

  it("recorta los avances fuera de rango en vez de extrapolar", () => {
    expect(puntoDePista(-3)).toEqual(puntoDePista(0));
    expect(puntoDePista(42)).toEqual(puntoDePista(1));
  });
});

describe("@keyframes corre-tramo contra la curva de TypeScript", () => {
  const fotogramas = fotogramasDelCss();

  it("tiene fotogramas en 0% y 100%", () => {
    expect(fotogramas.length).toBeGreaterThanOrEqual(5);
    expect(fotogramas[0].pct).toBe(0);
    expect(fotogramas[fotogramas.length - 1].pct).toBe(100);
  });

  // La tolerancia es la del redondeo con que están escritos los valores en el
  // CSS: dos decimales en vh, cuatro en la escala.
  it.each(fotogramas)("el fotograma %j sale de puntoDePista", ({ pct, y, escala }) => {
    const esperado = puntoDePista(pct / 100);
    expect(y).toBeCloseTo(esperado.y, 2);
    expect(escala).toBeCloseTo(esperado.escala, 4);
  });
});

describe("tramos", () => {
  const tramos = tramosDePista();

  it("reparte ocho tramos a lo largo del ciclo", () => {
    expect(tramos).toHaveLength(8);
    expect(tramos[tramos.length - 1].escala).toBeCloseTo(1, 6);
  });

  it("ninguno queda en el punto de fuga: con movimiento reducido se ve la pista", () => {
    // Es la prueba del error que tuvo la cortina de nubes. Si todos los
    // tramos comparten posición de reposo, la versión quieta es una pista
    // vacía y la espera vuelve a ser una pantalla muerta.
    const posiciones = new Set(tramos.map((t) => t.y.toFixed(4)));
    expect(posiciones.size).toBe(tramos.length);
    for (const tramo of tramos) {
      expect(tramo.escala).toBeGreaterThan(0.03);
    }
    // Y al menos la mitad tienen que caer en la parte visible de la pantalla,
    // no amontonados contra el horizonte.
    expect(tramos.filter((t) => t.y > 2).length).toBeGreaterThanOrEqual(4);
  });

  it("arranca el ciclo por la mitad, así la pista está poblada desde el primer fotograma", () => {
    for (const tramo of tramos) {
      expect(tramo.retrasoMs).toBeLessThanOrEqual(0);
      expect(tramo.retrasoMs).toBeGreaterThanOrEqual(-CICLO_MS);
    }
    expect(new Set(tramos.map((t) => t.retrasoMs)).size).toBe(tramos.length);
  });
});

describe("asfalto", () => {
  it("el borde pasa por fuera de las luces a toda distancia", () => {
    // Lo que se está protegiendo es que las luces de borde se vean apoyadas en
    // el asfalto. Si el polígono queda más angosto que `BORDE_VW · escala`,
    // las luces flotan sobre el pasto.
    const puntos = bordesDelAsfalto(12)
      .split(" ")
      .map((p) => p.split(",").map(Number));
    expect(puntos).toHaveLength(26); // 13 muestras por lado

    for (const [x, y] of puntos) {
      // Se recupera el avance desde la altura: y = 54 + 50·a³.
      const avance = Math.cbrt(Math.max(0, (y - 54) / 50));
      const { escala } = puntoDePista(avance);
      expect(Math.abs(x - 50)).toBeGreaterThanOrEqual(BORDE_VW * escala);
    }
  });

  it("es un polígono cerrable: mismo número de puntos por lado y simétrico", () => {
    const puntos = bordesDelAsfalto(6)
      .split(" ")
      .map((p) => p.split(",").map(Number));
    const mitad = puntos.length / 2;
    for (let i = 0; i < mitad; i++) {
      const derecho = puntos[i];
      const izquierdo = puntos[puntos.length - 1 - i];
      expect(izquierdo[1]).toBeCloseTo(derecho[1], 6);
      expect(50 - izquierdo[0]).toBeCloseTo(derecho[0] - 50, 6);
    }
  });
});

describe("destellos secuenciados", () => {
  it("corren de lejos a cerca y caben en el ciclo del destello", () => {
    expect(DESTELLOS.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < DESTELLOS.length; i++) {
      expect(DESTELLOS[i].y).toBeGreaterThan(DESTELLOS[i - 1].y);
      expect(DESTELLOS[i].retrasoMs).toBeGreaterThan(DESTELLOS[i - 1].retrasoMs);
    }
    // El barrido entero tiene que entrar dentro de un ciclo de 1100 ms, que es
    // lo que dura `destella-pista`. Si se pasa, el conejo se solapa consigo
    // mismo y deja de leerse como una secuencia.
    expect(DESTELLOS[DESTELLOS.length - 1].retrasoMs).toBeLessThan(1100);
  });

  it("se queda del lado lejano de la pista", () => {
    // Son luces de aproximación: viven antes del umbral, no sobre el asfalto
    // que ya está pasando por debajo.
    for (const d of DESTELLOS) {
      expect(d.y).toBeLessThan(5);
    }
  });
});

describe("movimiento reducido", () => {
  it("deja los tramos quietos pero repartidos, no apilados", () => {
    const bloque = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g;
    const bloques = [...CSS.matchAll(bloque)].map((m) => m[0]);
    const dePista = bloques.find((b) => b.includes(".pista-tramo"));
    expect(dePista, "falta el bloque de movimiento reducido de la pista").toBeDefined();
    expect(dePista).toContain("animation: none");
    expect(dePista).toContain("var(--y)");
    expect(dePista).toContain("var(--escala)");
  });

  it("la cortina está marcada para salir del barrido global", () => {
    // El barrido de `globals.css` apaga toda animación con `!important`. Sin
    // el atributo, nada de lo de arriba llega a aplicarse.
    const componente = readFileSync(
      join(process.cwd(), "src/components/cortina-de-pista.tsx"),
      "utf8",
    );
    expect(componente).toContain("data-movimiento-propio");
  });
});
