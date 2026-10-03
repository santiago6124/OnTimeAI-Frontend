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
      factor("ORIG_WX_SKNT", 0.4),
    ]);
    expect(m.map((x) => x.peso)).toEqual([...m.map((x) => x.peso)].sort((a, b) => b - a));
    expect(m[0].texto).toContain("avión");
  });

  it("NO descarta ninguna feature, ni las que no tienen frase propia", () => {
    // La primera versión omitía lo que no sabía explicar. Medido sobre 69.703
    // predicciones reales, eso dejaba al 27,5% con su razón PRINCIPAL fuera de
    // la lista: el viajero veía motivos secundarios como si fueran la
    // explicación.
    const m = motivosParaViajero([
      factor("una_feature_que_no_existe_todavia", 0.9),
      factor("prev_arr_delay_tail", 0.2),
    ]);
    expect(m).toHaveLength(2);
    expect(m[0].generico).toBe(true);
    expect(m[0].texto).toBeTruthy();
  });

  it("la de más peso aparece primera aunque no tenga frase propia", () => {
    const m = motivosParaViajero([
      factor("prev_arr_delay_tail", 0.2),
      factor("feature_nueva", 0.95),
    ]);
    expect(m[0].generico).toBe(true);
    expect(m[0].peso).toBe(1);
  });

  it("el respaldo usa la etiqueta del backend, no el nombre crudo", () => {
    const f: ShapFactor = {
      feature: "ORIG_WX_MYSTERY",
      label: "Fenómeno raro en origen",
      contribution: 0.5,
      direction: "positive",
    };
    expect(motivosParaViajero([f])[0].texto).toContain("Fenómeno raro en origen");
  });

  it("cubre las features que más veces son la principal en producción", () => {
    // Medido sobre `prediction_shap`: estas seis concentran el 84% de los
    // casos en que son la razón número uno. Ninguna puede caer al respaldo.
    const principales = [
      "CRS_ELAPSED_TIME", "TAIL_DELAY_DECAY", "prev_turnaround_tail_min",
      "congestion_orig_window", "DEST", "DISTANCE",
    ];
    for (const nombre of principales) {
      const [m] = motivosParaViajero([factor(nombre, 1)]);
      expect(m.generico, `${nombre} debería tener frase propia`).toBe(false);
    }
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
      "carrier_delay_rate_24h", "ORIG_WX_SKNT", "ORIG_WX_VSBY",
      "congestion_orig_window",
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
      factor("ORIG_WX_SKNT", 0.5),
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
