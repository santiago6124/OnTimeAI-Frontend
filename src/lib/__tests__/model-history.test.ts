/**
 * Lectura de la serie de calidad del modelo.
 *
 * El caso que motiva casi todo esto es real: el 2026-08-18 producción registró
 * AUC 0.0588 sobre 18 vuelos aterrizados, contra ~520 de un día normal. Ese
 * punto graficado junto a los demás parece el día que el modelo colapsó. No
 * colapsó nada: no había con qué medir.
 */
import { describe, expect, it } from "vitest";

import type { ModelHistoryPoint } from "@/lib/api";
import {
  AUC_TEST,
  MINIMO_CONFIABLE,
  cambiosDeModelo,
  compararPeriodos,
  diasDescartados,
  esConfiable,
  promedioMovil,
  tendencia,
} from "@/lib/model-history";

function dia(
  day: string,
  n_flights: number,
  campos: Partial<ModelHistoryPoint> = {},
): ModelHistoryPoint {
  return {
    day,
    n_flights,
    n_delayed: 0,
    n_flagged: 0,
    actual_delay_rate: null,
    precision: null,
    recall: null,
    auc: null,
    brier: null,
    ece: null,
    mean_proba: null,
    mean_threshold: null,
    model_version: "4year_v9",
    ...campos,
  };
}

/** Días consecutivos con el mismo AUC y volumen normal. */
function serie(auc: number[], n_flights = 520) {
  return auc.map((v, i) =>
    dia(`2026-09-${String(i + 1).padStart(2, "0")}`, n_flights, { auc: v }),
  );
}

describe("qué día puede decir algo", () => {
  it("un día de volumen normal cuenta", () => {
    expect(esConfiable(dia("2026-09-14", 565))).toBe(true);
  });

  it("el 2026-08-18 real, con 18 vuelos, no cuenta", () => {
    expect(esConfiable(dia("2026-08-18", 18, { auc: 0.0588 }))).toBe(false);
  });

  it("el mínimo se cumple por igual, no por exceso", () => {
    expect(esConfiable(dia("x", MINIMO_CONFIABLE))).toBe(true);
    expect(esConfiable(dia("x", MINIMO_CONFIABLE - 1))).toBe(false);
  });
});

describe("promedio móvil", () => {
  it("no deja que un día de muestra chica hunda la curva", () => {
    // Seis días buenos y en el medio el 18 de agosto real.
    const puntos = [
      ...serie([0.74, 0.75, 0.76]),
      dia("2026-09-04", 18, { auc: 0.0588 }),
      ...serie([0.75, 0.74, 0.76]).map((p, i) =>
        dia(`2026-09-0${i + 5}`, 520, { auc: p.auc }),
      ),
    ];

    const media = promedioMovil(puntos, "auc");
    const ultimo = media[media.length - 1];
    expect(ultimo).not.toBeNull();
    // Si el 0.0588 entrara, el promedio caería cerca de 0.64.
    expect(ultimo!).toBeGreaterThan(0.7);
  });

  it("no publica un promedio de dos días como si fuera de siete", () => {
    const media = promedioMovil(serie([0.74, 0.75]), "auc");
    expect(media).toEqual([null, null]);
  });

  it("empieza a publicar recién con media ventana", () => {
    const media = promedioMovil(serie([0.7, 0.7, 0.7, 0.7]), "auc");
    expect(media.slice(0, 3)).toEqual([null, null, null]);
    expect(media[3]).toBeCloseTo(0.7, 10);
  });

  it("ignora los nulos sin contarlos como cero", () => {
    const puntos = [
      ...serie([0.8, 0.8, 0.8, 0.8]),
      dia("2026-09-05", 520, { auc: null }),
    ];
    expect(promedioMovil(puntos, "auc")[4]).toBeCloseTo(0.8, 10);
  });
});

describe("comparación entre períodos", () => {
  it("compara la última semana contra la anterior", () => {
    const puntos = serie([
      // semana previa: 0.70
      0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7,
      // semana reciente: 0.80
      0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8,
    ]);
    const c = compararPeriodos(puntos, "auc")!;
    expect(c.actual).toBeCloseTo(0.8, 10);
    expect(c.previo).toBeCloseTo(0.7, 10);
    expect(c.delta).toBeCloseTo(0.1, 10);
    expect(c.dias).toBe(7);
  });

  it("no compara contra una ventana incompleta", () => {
    // Nueve días: siete recientes y solo dos previos. Comparar 7 contra 2
    // inventaría un cambio que sale de cuántos días había, no del modelo.
    const c = compararPeriodos(serie([0.7, 0.7, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]), "auc")!;
    expect(c.previo).toBeNull();
    expect(c.delta).toBeNull();
  });

  it("devuelve null cuando ningún día confiable tiene la métrica", () => {
    expect(compararPeriodos([dia("2026-09-01", 18, { auc: 0.05 })], "auc")).toBeNull();
    expect(compararPeriodos(serie([0.8]).map((p) => ({ ...p, ece: null })), "ece")).toBeNull();
  });
});

describe("hacia dónde mejora cada métrica", () => {
  it("el AUC mejora subiendo", () => {
    expect(tendencia("auc", 0.05)).toBe("mejor");
    expect(tendencia("auc", -0.05)).toBe("peor");
  });

  it("el ECE mejora BAJANDO", () => {
    // Es la inversión que, mal puesta, pinta de verde una calibración que
    // empeoró. El ECE de producción bajó de 0.29 a 0.21: eso es mejor.
    expect(tendencia("ece", -0.08)).toBe("mejor");
    expect(tendencia("ece", 0.08)).toBe("peor");
  });

  it("el Brier también mejora bajando", () => {
    expect(tendencia("brier", -0.02)).toBe("mejor");
  });

  it("un movimiento de la cuarta decimal no es noticia", () => {
    expect(tendencia("auc", 0.001)).toBe("igual");
    expect(tendencia("ece", -0.001)).toBe("igual");
  });

  it("sin comparación previa no inventa una tendencia", () => {
    expect(tendencia("auc", null)).toBe("sin-datos");
  });
});

describe("lo que la pantalla tiene que poder contar", () => {
  it("cuenta los días descartados", () => {
    const puntos = [
      dia("2026-08-16", 16),
      dia("2026-08-17", 533),
      dia("2026-08-18", 18),
      dia("2026-08-19", 191),
      dia("2026-08-20", 526),
    ];
    // Los cuatro primeros son los reales de producción: tres no llegan.
    expect(diasDescartados(puntos)).toBe(3);
  });

  it("marca el día en que cambió el modelo", () => {
    const puntos = [
      dia("2026-09-01", 520, { model_version: "4year_v9" }),
      dia("2026-09-02", 520, { model_version: "4year_v9" }),
      dia("2026-09-03", 520, { model_version: "4year_v9_recal" }),
    ];
    expect(cambiosDeModelo(puntos)).toEqual([
      { day: "2026-09-03", from: "4year_v9", to: "4year_v9_recal" },
    ]);
  });

  it("no marca cambio donde solo falta el dato", () => {
    const puntos = [
      dia("2026-09-01", 520, { model_version: "4year_v9" }),
      dia("2026-09-02", 520, { model_version: null }),
      dia("2026-09-03", 520, { model_version: "4year_v9" }),
    ];
    expect(cambiosDeModelo(puntos)).toEqual([]);
  });

  it("el AUC de test es el número contra el que se compara el vivo", () => {
    // Si cambia el modelo activo, este número tiene que cambiar con él.
    expect(AUC_TEST).toBe(0.847);
  });
});
