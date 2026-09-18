/**
 * Las páginas que las tiendas exigen públicas tienen que abrir sin sesión.
 *
 * Apple verifica la URL de la política de privacidad y la de soporte antes de
 * aceptar el envío a revisión; si el proxy las manda al login, el envío se
 * rechaza sin que ningún test ni build lo anticipe. Este test es ese aviso.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "../proxy";

/** Ruta → quién exige que sea pública. */
const PUBLICAS = [
  ["/privacidad", "App Store Connect y Play: URL de política de privacidad"],
  ["/soporte", "App Store Connect: URL de soporte"],
  ["/live", "Modo Lite (issue #1)"],
] as const;

function pedir(pathname: string) {
  return proxy(new NextRequest(`https://app.test${pathname}`));
}

describe("proxy: rutas públicas", () => {
  for (const [ruta, motivo] of PUBLICAS) {
    it(`deja pasar ${ruta} sin sesión — ${motivo}`, () => {
      const respuesta = pedir(ruta);
      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get("location")).toBeNull();
    });
  }

  it("sigue exigiendo sesión para el resto", () => {
    const respuesta = pedir("/flights");
    expect(respuesta.status).toBeGreaterThanOrEqual(300);
    expect(respuesta.headers.get("location")).toContain("/login");
  });
});
