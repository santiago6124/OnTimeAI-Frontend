/**
 * Los cuatro estados de la pantalla de anticipación.
 *
 * El repo no tiene `testing-library` ni `jsdom`, así que el render no es
 * testeable sin agregar dependencias. Lo que sí se puede fijar —y es lo que
 * importa— es la precedencia entre estados, porque dos de ellos se confunden
 * con facilidad y los dos errores mienten en pantalla:
 *
 * - cargar confundido con error: la pantalla dice "no pudimos traer la
 *   métrica" mientras simplemente está esperando. Pasó en la primera versión,
 *   que decidía con `fetchError || !datos`.
 * - acumular confundido con listo: con ventaja cero la pantalla diría que no
 *   tenemos anticipación, cuando lo que pasa es que todavía no hay con qué
 *   medirla. Es el estado que más se va a ver al principio.
 */
import { describe, expect, it } from "vitest";

import type { LeadTime } from "@/lib/api";
import { estadoDeLaVista, fmtMinutos } from "@/components/tesis/anticipacion-view";

const LISTO: LeadTime = {
  disponible: true,
  desde_utc: "2026-10-16T01:57:31+00:00",
  dias: 30,
  n_vuelos_con_resultado: 900,
  n_demorados: 120,
  n_comparables: 80,
  ventaja_promedio_min: 135,
  ventaja_mediana_min: 110,
  win_rate_60min: 0.72,
  n_puntos_ciegos: 14,
  histograma: [],
  advertencia: "llegada vs salida",
};

const ACUMULANDO: LeadTime = {
  disponible: false,
  motivo: "todavía no hay vuelos demorados con las dos marcas",
  desde_utc: "2026-10-16T01:57:31+00:00",
};

describe("estadoDeLaVista", () => {
  it("cargar gana sobre todo lo demás", () => {
    // Durante el fallback de Suspense `datos` llega en null, que es la misma
    // forma que un fallo de red.
    expect(estadoDeLaVista(null, { cargando: true })).toBe("cargando");
    expect(estadoDeLaVista(null, { cargando: true, fetchError: true })).toBe("cargando");
    expect(estadoDeLaVista(LISTO, { cargando: true })).toBe("cargando");
  });

  it("sin datos y sin estar cargando es error, no acumulando", () => {
    // Si cayera en "acumulando", un backend caído se vería como "estamos
    // juntando datos", que es tranquilizador y falso.
    expect(estadoDeLaVista(null)).toBe("error");
    expect(estadoDeLaVista(null, { fetchError: true })).toBe("error");
  });

  it("un fallo de red no se disfraza de métrica vacía", () => {
    expect(estadoDeLaVista(LISTO, { fetchError: true })).toBe("error");
  });

  it("distingue acumulando de listo", () => {
    expect(estadoDeLaVista(ACUMULANDO)).toBe("acumulando");
    expect(estadoDeLaVista(LISTO)).toBe("listo");
  });

  it("una ventaja de cero sigue siendo listo, no acumulando", () => {
    // Cero es un resultado: significa que empatamos con la aerolínea. No es
    // lo mismo que no tener datos.
    expect(estadoDeLaVista({ ...LISTO, ventaja_promedio_min: 0 })).toBe("listo");
  });
});

describe("fmtMinutos", () => {
  it("menos de una hora en minutos", () => {
    expect(fmtMinutos(0)).toBe("0 min");
    expect(fmtMinutos(45)).toBe("45 min");
    expect(fmtMinutos(59)).toBe("59 min");
  });

  it("a partir de una hora, en horas y minutos", () => {
    expect(fmtMinutos(60)).toBe("1 h");
    expect(fmtMinutos(135)).toBe("2 h 15 min");
    expect(fmtMinutos(240)).toBe("4 h");
  });

  it("no imprime el signo: lo pone quien llama", () => {
    // La ventaja puede ser negativa —la aerolínea avisó primero— y el signo se
    // decide en la vista para poder pintarlo en rojo.
    expect(fmtMinutos(-135)).toBe("2 h 15 min");
  });

  it("redondea en vez de mostrar decimales", () => {
    expect(fmtMinutos(44.6)).toBe("45 min");
    expect(fmtMinutos(119.5)).toBe("2 h");
  });
});
