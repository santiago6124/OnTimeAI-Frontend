/**
 * CP-COB-FE-21 — `useWeatherStations`: la URL del agregador según los ids, el
 * estado inicial y lo que hace `reload()`.
 *
 * Se renderiza con `react-dom/server` (no hay DOM acá): los efectos no corren,
 * así que lo que se fija es el estado de arranque y que `reload` pida la URL
 * correcta con `Accept: application/json` y sin caché.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWeatherStations } from "@/hooks/use-weather-stations";

type Resultado = ReturnType<typeof useWeatherStations>;

function capturar(ids?: string[]) {
  const caja: { valor?: Resultado } = {};
  function Sonda() {
    caja.valor = useWeatherStations(ids);
    return null;
  }
  renderToString(createElement(Sonda));
  return caja.valor as Resultado;
}

const llamadas: Array<{ url: string; init: RequestInit }> = [];

function proxy(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      llamadas.push({ url: String(url), init });
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

afterEach(() => {
  llamadas.length = 0;
  vi.unstubAllGlobals();
});

describe("useWeatherStations", () => {
  it("arranca cargando y sin datos", () => {
    // Act
    const estado = capturar();

    // Assert
    expect(estado).toMatchObject({ status: "loading", data: null, error: null });
    expect(typeof estado.reload).toBe("function");
  });

  it("sin ids pide /api/weather; con ids los pasa en la query", async () => {
    proxy(200, { stations: [] });

    await capturar().reload();
    await capturar(["KATL", "KMIA"]).reload();

    expect(llamadas.map((l) => l.url)).toEqual(["/api/weather", "/api/weather?ids=KATL,KMIA"]);
    expect(llamadas[0].init.cache).toBe("no-store");
    expect((llamadas[0].init.headers as Record<string, string>).Accept).toBe("application/json");
  });

  it("una lista vacía de ids cuenta como 'todas'", async () => {
    proxy(200, { stations: [] });

    await capturar([]).reload();

    expect(llamadas[0].url).toBe("/api/weather");
  });

  it("reload no lanza cuando el proxy falla", async () => {
    proxy(502, { error: "AWC devolvió 503" });

    await expect(capturar().reload()).resolves.toBeUndefined();
  });
});
