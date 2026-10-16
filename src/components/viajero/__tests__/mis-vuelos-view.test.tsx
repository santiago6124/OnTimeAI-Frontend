/**
 * «No guardaste nada» y «no pudimos traerlos» son cosas distintas.
 *
 * Antes cualquier fallo del servidor —un 401, un timeout, el backend caído—
 * terminaba en lista vacía, y la pantalla invitaba a buscar un vuelo como si
 * el viajero nunca hubiera guardado ninguno. Además de mentir, hacía imposible
 * diagnosticar desde afuera: el fetch corre en el servidor y no se ve en la
 * pestaña de red.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VISTA = readFileSync(
  join(process.cwd(), "src", "components", "viajero", "mis-vuelos-view.tsx"),
  "utf8",
);

const PAGINA = readFileSync(
  join(process.cwd(), "src", "app", "mis-vuelos", "page.tsx"),
  "utf8",
);

describe("mis vuelos", () => {
  it("la vista recibe si la carga fallo", () => {
    expect(VISTA).toMatch(/fallo\s*=\s*false/);
  });

  it("el fallo se revisa antes del vacio", () => {
    const iFallo = VISTA.indexOf("if (fallo");
    const iVacio = VISTA.indexOf("if (vuelos.length === 0)");
    expect(iFallo).toBeGreaterThan(-1);
    expect(iVacio).toBeGreaterThan(-1);
    expect(iFallo).toBeLessThan(iVacio);
  });

  it("no invita a buscar un vuelo cuando la carga fallo", () => {
    const bloque = VISTA.slice(
      VISTA.indexOf("if (fallo"),
      VISTA.indexOf("if (vuelos.length === 0)"),
    );
    expect(bloque).not.toMatch(/Buscar un vuelo/);
    expect(bloque).toMatch(/No pudimos traer tus vuelos/);
  });

  it("la pagina loguea el error en vez de tragarselo", () => {
    expect(PAGINA).toMatch(/catch \(error\)/);
    expect(PAGINA).toMatch(/console\.error/);
    expect(PAGINA).not.toMatch(/catch \{\s*return \[\];/);
  });
});
