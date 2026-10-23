/**
 * CP-COB-FE-20 — `useFlights`: el estado inicial que ve el primer render y lo
 * que hace `reload()`.
 *
 * Se renderiza con `react-dom/server` (no hay DOM acá): los efectos no corren,
 * así que lo que se fija es el estado de arranque —cargando, sin vuelos, sin
 * error— y que `reload` vaya a `/flights` y no lance cuando el backend falla.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFlights } from "@/hooks/use-flights";

type Resultado = ReturnType<typeof useFlights>;

function capturar() {
  const caja: { valor?: Resultado } = {};
  function Sonda() {
    caja.valor = useFlights();
    return null;
  }
  renderToString(createElement(Sonda));
  return caja.valor as Resultado;
}

const llamadas: string[] = [];

function backend(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      llamadas.push(String(url));
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

afterEach(() => {
  llamadas.length = 0;
  vi.unstubAllGlobals();
});

describe("useFlights", () => {
  it("arranca cargando, sin vuelos, sin error y sin fecha", () => {
    // Act
    const estado = capturar();

    // Assert
    expect(estado).toMatchObject({
      flights: [],
      loading: true,
      isRefreshing: false,
      error: null,
      lastUpdated: null,
    });
    expect(typeof estado.reload).toBe("function");
  });

  it("reload pide la lista completa de vuelos", async () => {
    backend(200, []);
    const { reload } = capturar();

    await reload();

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toMatch(/\/flights$/);
  });

  it("reload no lanza cuando el backend falla: el error va al estado", async () => {
    backend(500, { detail: "Base caída" });
    const { reload } = capturar();

    await expect(reload()).resolves.toBeUndefined();
  });
});
