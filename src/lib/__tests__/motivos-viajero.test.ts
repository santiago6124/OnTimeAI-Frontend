/**
 * Traducir el SHAP a algo que un pasajero entienda.
 *
 * El panel de operaciones muestra `prev_arr_delay_tail` con su valor y eso
 * está bien para quien sabe qué es. A un viajero hay que decirle "el avión
 * que hace este vuelo viene demorado", y eso depende del signo: la misma
 * variable empuja en direcciones opuestas.
 */
import { describe, expect, it } from "vitest";

import type { ShapFactor } from "@/lib/api";
import { motivosParaViajero, veredicto } from "@/lib/motivos-viajero";

function factor(
  feature: string,
  contribution: number,
  direction: "positive" | "negative" = "positive",
): ShapFactor {
  return { feature, label: feature, contribution, direction };
}

describe("motivosParaViajero", () => {
  it("dice lo contrario según la dirección", () => {
    const sube = motivosParaViajero([factor("prev_arr_delay_tail", 0.3, "positive")]);
    const baja = motivosParaViajero([factor("prev_arr_delay_tail", 0.3, "negative")]);

    expect(sube[0].texto).toContain("viene demorado");
    expect(sube[0].enContra).toBe(true);
    expect(baja[0].texto).toContain("en horario");
    expect(baja[0].enContra).toBe(false);
  });

  it("usa `direction` y no el signo de `contribution`", () => {
    // El endpoint puede devolver la contribución ya en valor absoluto. Si el
    // signo se infiriera de ahí, todos los motivos caerían del mismo lado.
    const m = motivosParaViajero([factor("origin_delay_rate_1h", 0.4, "negative")]);
    expect(m[0].enContra).toBe(false);
  });

  it("ordena del que más pesa al que menos", () => {
    const m = motivosParaViajero([
      factor("dest_delay_rate_1h", 0.1),
      factor("prev_arr_delay_tail", 0.9),
      factor("sknt_origin", 0.4),
    ]);
    expect(m.map((x) => x.peso)).toEqual([...m.map((x) => x.peso)].sort((a, b) => b - a));
    expect(m[0].texto).toContain("avión");
  });

  it("omite las features que no se pueden explicar en una línea", () => {
    // `CRS_DEP_MIN_sin` y `PAGERANK_ORIGIN` son reales y pesan, pero no hay
    // forma honesta de contárselas a un pasajero. Una explicación que no se
    // entiende es peor que una explicación de menos.
    const m = motivosParaViajero([
      factor("CRS_DEP_MIN_sin", 0.9),
      factor("PAGERANK_ORIGIN", 0.8),
      factor("prev_arr_delay_tail", 0.2),
    ]);
    expect(m).toHaveLength(1);
    expect(m[0].texto).toContain("avión");
  });

  it("no repite la misma frase por varias ventanas de la misma señal", () => {
    // origen a 1 h, 6 h y 24 h pueden traducirse parecido; repetirlo hace ver
    // como ruido lo que es una sola causa.
    const m = motivosParaViajero([
      factor("origin_delay_rate_1h", 0.5),
      factor("origin_delay_rate_6h", 0.4),
      factor("origin_delay_rate_24h", 0.3),
    ]);
    expect(new Set(m.map((x) => x.texto)).size).toBe(m.length);
  });

  it("recorta: cuatro razones, no quince", () => {
    const muchos = [
      "prev_arr_delay_tail", "origin_delay_rate_1h", "dest_delay_rate_1h",
      "carrier_delay_rate_24h", "sknt_origin", "vsby_origin", "congestion_score",
    ].map((f, i) => factor(f, 1 - i * 0.1));
    expect(motivosParaViajero(muchos)).toHaveLength(4);
  });

  it("sin factores devuelve una lista vacía, no explota", () => {
    expect(motivosParaViajero(undefined)).toEqual([]);
    expect(motivosParaViajero([])).toEqual([]);
  });

  it("el peso es relativo al motivo más fuerte", () => {
    const m = motivosParaViajero([
      factor("prev_arr_delay_tail", 1.0),
      factor("sknt_origin", 0.5),
    ]);
    expect(m[0].peso).toBe(1);
    expect(m[1].peso).toBeCloseTo(0.5, 5);
  });
});

describe("veredicto", () => {
  it("habla en palabras antes que en número", () => {
    expect(veredicto(0.05).titulo).toMatch(/horario/i);
    expect(veredicto(0.3).titulo).toMatch(/puede/i);
    expect(veredicto(0.8).titulo).toMatch(/probable/i);
  });

  it("los umbrales no se solapan ni dejan huecos", () => {
    const titulos = [0, 0.19, 0.2, 0.49, 0.5, 1].map((p) => veredicto(p).titulo);
    expect(titulos[0]).toBe(titulos[1]);
    expect(titulos[2]).toBe(titulos[3]);
    expect(titulos[4]).toBe(titulos[5]);
    expect(new Set(titulos).size).toBe(3);
  });
});
