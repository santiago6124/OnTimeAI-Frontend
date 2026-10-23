/**
 * CP-COB-FE-11 — `src/lib/geo.ts`: la geometría del mapa.
 *
 * Cubre `greatCirclePoint` en los extremos, en el punto medio (la ortodrómica
 * se comba hacia el polo) y con origen igual a destino; `initialBearing` en
 * los cuatro rumbos cardinales; `greatCirclePath` y la consistencia del
 * catálogo `AIRPORTS`.
 */
import { describe, expect, it } from "vitest";

import { AIRPORTS, greatCirclePath, greatCirclePoint, initialBearing } from "@/lib/geo";

const ATL = AIRPORTS.ATL;
const LAX = AIRPORTS.LAX;

describe("greatCirclePoint", () => {
  it("en f=0 está en el origen y en f=1 en el destino", () => {
    // Act
    const inicio = greatCirclePoint(ATL, LAX, 0);
    const fin = greatCirclePoint(ATL, LAX, 1);

    // Assert
    expect(inicio.lat).toBeCloseTo(ATL.lat, 6);
    expect(inicio.lng).toBeCloseTo(ATL.lng, 6);
    expect(fin.lat).toBeCloseTo(LAX.lat, 6);
    expect(fin.lng).toBeCloseTo(LAX.lng, 6);
  });

  it("el punto medio ATL→LAX queda al norte de ambos: es ortodrómica, no recta", () => {
    const medio = greatCirclePoint(ATL, LAX, 0.5);

    expect(medio.lat).toBeGreaterThan(Math.max(ATL.lat, LAX.lat));
    expect(medio.lng).toBeGreaterThan(LAX.lng);
    expect(medio.lng).toBeLessThan(ATL.lng);
  });

  it("con origen igual a destino devuelve el mismo punto sin dividir por cero", () => {
    expect(greatCirclePoint(ATL, { lat: ATL.lat, lng: ATL.lng }, 0.5)).toEqual({ lat: ATL.lat, lng: ATL.lng });
  });
});

describe("initialBearing", () => {
  const centro = { lat: 0, lng: 0 };

  it.each([
    ["norte", { lat: 10, lng: 0 }, 0],
    ["este", { lat: 0, lng: 10 }, 90],
    ["sur", { lat: -10, lng: 0 }, 180],
    ["oeste", { lat: 0, lng: -10 }, 270],
  ])("hacia el %s es %i°", (_rumbo, destino, grados) => {
    expect(initialBearing(centro, destino)).toBeCloseTo(grados, 6);
  });

  it("ATL→LAX sale hacia el oeste-noroeste", () => {
    const rumbo = initialBearing(ATL, LAX);
    expect(rumbo).toBeGreaterThan(270);
    expect(rumbo).toBeLessThan(300);
  });
});

describe("greatCirclePath", () => {
  it("devuelve steps+1 puntos de origen a destino", () => {
    const camino = greatCirclePath(ATL, LAX, 4);

    expect(camino).toHaveLength(5);
    expect(camino[0][0]).toBeCloseTo(ATL.lat, 6);
    expect(camino[0][1]).toBeCloseTo(ATL.lng, 6);
    expect(camino[4][0]).toBeCloseTo(LAX.lat, 6);
    expect(camino[4][1]).toBeCloseTo(LAX.lng, 6);
  });

  it("por defecto son 65 puntos", () => {
    expect(greatCirclePath(ATL, LAX)).toHaveLength(65);
  });
});

describe("AIRPORTS", () => {
  it("cada clave coincide con su código y tiene coordenadas válidas", () => {
    for (const [clave, aeropuerto] of Object.entries(AIRPORTS)) {
      expect(aeropuerto.code).toBe(clave);
      expect(Math.abs(aeropuerto.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(aeropuerto.lng)).toBeLessThanOrEqual(180);
    }
  });
});
