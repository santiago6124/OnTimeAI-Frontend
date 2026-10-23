/**
 * CP-COB-FE-13 — `src/lib/mock-data.ts`: los vuelos de demostración se
 * proyectan sobre la ortodrómica al cargarse. Lo que vale fijar es que ningún
 * vuelo quede en (0, 0) por una ruta sin aeropuerto en el catálogo, que el
 * progreso esté acotado y que `getFlightById` encuentre lo que hay.
 */
import { describe, expect, it } from "vitest";

import { AIRPORTS } from "@/lib/geo";
import { getFlightById, MOCK_FLIGHTS, MOCK_METRICS, MOCK_WEATHER_STATIONS } from "@/lib/mock-data";

describe("MOCK_FLIGHTS", () => {
  it("todas las rutas están en el catálogo y ningún avión queda en (0, 0)", () => {
    for (const vuelo of MOCK_FLIGHTS) {
      expect(AIRPORTS[vuelo.origin], vuelo.id).toBeDefined();
      expect(AIRPORTS[vuelo.destination], vuelo.id).toBeDefined();
      expect(vuelo.currentLat !== 0 || vuelo.currentLng !== 0, vuelo.id).toBe(true);
    }
  });

  it("el progreso está en [0, 1], el rumbo en [0, 360) y el SHAP nunca es null", () => {
    for (const vuelo of MOCK_FLIGHTS) {
      expect(vuelo.progress).toBeGreaterThanOrEqual(0);
      expect(vuelo.progress).toBeLessThanOrEqual(1);
      expect(vuelo.bearing).toBeGreaterThanOrEqual(0);
      expect(vuelo.bearing).toBeLessThan(360);
      expect(Array.isArray(vuelo.shap)).toBe(true);
    }
  });

  it("altitud y velocidad son plausibles para crucero", () => {
    for (const vuelo of MOCK_FLIGHTS) {
      expect(vuelo.altitudeFt).toBeGreaterThanOrEqual(24000);
      expect(vuelo.altitudeFt).toBeLessThanOrEqual(36000);
      expect(vuelo.groundSpeedKt).toBeGreaterThanOrEqual(410);
      expect(vuelo.groundSpeedKt).toBeLessThanOrEqual(470);
    }
  });
});

describe("getFlightById", () => {
  it("encuentra un vuelo por id y devuelve undefined si no existe", () => {
    expect(getFlightById("DL1841")?.flightNumber).toBe("DL 1841");
    expect(getFlightById("XX0000")).toBeUndefined();
  });
});

describe("métricas y estaciones de demostración", () => {
  it("totalFlights coincide con la cantidad de vuelos", () => {
    expect(MOCK_METRICS.totalFlights).toBe(MOCK_FLIGHTS.length);
  });

  it("las estaciones tienen código sin la K y coordenadas", () => {
    for (const estacion of MOCK_WEATHER_STATIONS) {
      expect(estacion.code).not.toMatch(/^K/);
      expect(Math.abs(estacion.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(estacion.lng)).toBeLessThanOrEqual(180);
    }
  });
});
