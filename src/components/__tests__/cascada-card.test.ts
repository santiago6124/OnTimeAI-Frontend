/**
 * Los cinco estados de la tarjeta de cascada.
 *
 * El repo no tiene `testing-library` ni `jsdom`, así que el render no es
 * testeable sin agregar dependencias. Lo que sí se puede fijar —y es lo que
 * importa— es la precedencia entre estados, porque dos pares se confunden y
 * los dos errores mienten en pantalla:
 *
 * - `sin_dato` contra `no_propaga`: la primera es "no conocemos la rotación de
 *   este avión" y la segunda "la conocemos y la demora no alcanza para
 *   arrastrarla". Mostrar lo mismo convierte un hueco de datos en un resultado
 *   tranquilizador, y hoy no conocemos la rotación a tiempo en el 67% de los
 *   vuelos.
 * - `cargando` contra `error`: con `datos` en null los dos se ven iguales, y
 *   la pantalla diría "no pudimos calcular" mientras espera.
 */
import { describe, expect, it } from "vitest";

import type { Cascada } from "@/lib/api";
import { estadoDeLaCascada } from "@/components/cascada-card";

const LISTA: Cascada = {
  vuelo: {},
  demora_origen: "real",
  demora_llegada_min: 45,
  aviso: null,
  piernas_conocidas: 2,
  piernas: [
    {
      fa_flight_id: "B", vuelo: "DL200", origen: "MIA", destino: "ATL",
      orden: 1, salida_programada_utc: "2026-10-19T15:00:00+00:00",
      holgura_min: 60, demora_salida_min: 59, demora_llegada_min: 55,
      demorado: true, cadena_rota: false,
    },
  ],
  nota: "proyección",
};

const SIN_DATO: Cascada = {
  vuelo: {}, piernas: [], piernas_conocidas: 0,
  motivo: "no conocemos la próxima pierna de este avión todavía",
};

const NO_PROPAGA: Cascada = {
  vuelo: {}, demora_origen: "real", demora_llegada_min: 8,
  piernas: [], piernas_conocidas: 3,
};

describe("estadoDeLaCascada", () => {
  it("cargar gana sobre todo lo demás", () => {
    expect(estadoDeLaCascada(null, { cargando: true })).toBe("cargando");
    expect(estadoDeLaCascada(LISTA, { cargando: true })).toBe("cargando");
    expect(estadoDeLaCascada(null, { cargando: true, error: true })).toBe("cargando");
  });

  it("sin datos y sin estar cargando es error", () => {
    expect(estadoDeLaCascada(null)).toBe("error");
  });

  it("un fallo de red no se disfraza de cascada vacía", () => {
    expect(estadoDeLaCascada(LISTA, { error: true })).toBe("error");
  });

  it("distingue no conocer la rotación de que no propague", () => {
    // Es la distinción central: hoy no conocemos la rotación a tiempo en el
    // 67% de los vuelos, así que `sin_dato` va a ser el caso frecuente.
    expect(estadoDeLaCascada(SIN_DATO)).toBe("sin_dato");
    expect(estadoDeLaCascada(NO_PROPAGA)).toBe("no_propaga");
  });

  it("el motivo gana aunque vengan piernas", () => {
    // Si el backend manda las dos cosas, el motivo es el que explica; mostrar
    // la lista callaría la advertencia.
    expect(estadoDeLaCascada({ ...LISTA, motivo: "algo pasó" })).toBe("sin_dato");
  });

  it("con piernas y sin motivo es lista", () => {
    expect(estadoDeLaCascada(LISTA)).toBe("lista");
  });

  it("una cascada que no propaga nada no es un error", () => {
    // `piernas_conocidas` en 3 con lista vacía es un resultado: conocemos la
    // rotación y la demora no alcanza.
    expect(estadoDeLaCascada(NO_PROPAGA)).not.toBe("error");
  });
});
