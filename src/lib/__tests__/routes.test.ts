/**
 * CP-COB-FE-09 — `src/lib/routes.ts`: el enlace al detalle de un vuelo tiene
 * dos formas (ruta dinámica en la web, ruta fija con query en el bundle) y
 * las dos salen de acá con el id escapado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function cargar(bundled: boolean) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_BUNDLED_APP", bundled ? "1" : "");
  return import("@/lib/routes");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("flightDetailHref", () => {
  it("en la web es la ruta dinámica con el id escapado", async () => {
    const { flightDetailHref } = await cargar(false);
    expect(flightDetailHref("SYN-DL100/ATL")).toBe("/flights/SYN-DL100%2FATL");
  });

  it("en el bundle es la ruta fija con el id en la query", async () => {
    const { flightDetailHref } = await cargar(true);
    expect(flightDetailHref("SYN-DL100/ATL")).toBe("/flights/detail/?id=SYN-DL100%2FATL");
  });
});
