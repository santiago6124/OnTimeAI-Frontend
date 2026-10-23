/**
 * CP-COB-FE-08 — `src/lib/mobile-env.ts`: las banderas de build que separan
 * la web del bundle de iOS.
 *
 * Lo que garantiza: sin variables, todo es identidad (la web no cambia ni un
 * carácter); con `NEXT_PUBLIC_BUNDLED_APP=1` los orígenes se normalizan sin
 * barra final y `appPath` agrega la barra que el router de assets de iOS
 * exige, conservando la query.
 *
 * El módulo lee `process.env` al cargarse, así que cada caso lo vuelve a
 * importar con el entorno simulado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function cargar(env: Record<string, string>) {
  vi.resetModules();
  for (const [clave, valor] of Object.entries(env)) vi.stubEnv(clave, valor);
  return import("@/lib/mobile-env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("en la web (sin variables)", () => {
  it("todo es identidad: BFF same-origin, sin orígenes y con reportes", async () => {
    // Arrange / Act
    const m = await cargar({ NEXT_PUBLIC_BUNDLED_APP: "", NEXT_PUBLIC_API_ORIGIN: "", NEXT_PUBLIC_APP_ORIGIN: "" });

    // Assert
    expect(m.IS_BUNDLED).toBe(false);
    expect(m.API_ORIGIN).toBe("");
    expect(m.APP_ORIGIN).toBe("");
    expect(m.REPORTS_ENABLED).toBe(true);
    expect(m.appUrl("/api/weather")).toBe("/api/weather");
    expect(m.appPath("/login")).toBe("/login");
    expect(m.appPath("/flights?x=1")).toBe("/flights?x=1");
  });
});

describe("en el bundle de iOS", () => {
  it("normaliza los orígenes sin espacios ni barras finales", async () => {
    const m = await cargar({
      NEXT_PUBLIC_BUNDLED_APP: "1",
      NEXT_PUBLIC_API_ORIGIN: " https://api.test/// ",
      NEXT_PUBLIC_APP_ORIGIN: "https://app.test/",
    });

    expect(m.IS_BUNDLED).toBe(true);
    expect(m.API_ORIGIN).toBe("https://api.test");
    expect(m.APP_ORIGIN).toBe("https://app.test");
    expect(m.appUrl("/api/weather")).toBe("https://app.test/api/weather");
  });

  it("appPath agrega la barra final y conserva la query", async () => {
    const m = await cargar({ NEXT_PUBLIC_BUNDLED_APP: "1" });

    expect(m.appPath("/login")).toBe("/login/");
    expect(m.appPath("/login/")).toBe("/login/");
    expect(m.appPath("/flights/detail?id=abc")).toBe("/flights/detail/?id=abc");
  });

  it("los reportes se apagan con NEXT_PUBLIC_DISABLE_REPORTS=1", async () => {
    const m = await cargar({ NEXT_PUBLIC_BUNDLED_APP: "1", NEXT_PUBLIC_DISABLE_REPORTS: "1" });

    expect(m.REPORTS_ENABLED).toBe(false);
  });
});
