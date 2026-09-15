/**
 * El campo de contraseña se puede revelar.
 *
 * Escribir a ciegas es la causa más común de que un alta falle en el segundo
 * intento, y en un teclado de teléfono es peor.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FUENTE = readFileSync(
  join(process.cwd(), "src", "components", "ui", "password-input.tsx"),
  "utf8",
);

describe("PasswordInput", () => {
  it("alterna el tipo del campo entre password y text", () => {
    expect(FUENTE).toContain('type={visible ? "text" : "password"}');
  });

  it("el botón no entra en el orden de tabulación", () => {
    // Quien navega con teclado busca avanzar al siguiente campo, no revelar.
    expect(FUENTE).toContain("tabIndex={-1}");
  });

  it("el botón es type=button", () => {
    // Sin esto envía el formulario al hacer clic, que es peor que no tenerlo.
    expect(FUENTE).toContain('type="button"');
  });

  it("anuncia su estado a lectores de pantalla", () => {
    expect(FUENTE).toContain("aria-pressed={visible}");
    expect(FUENTE).toContain("aria-label=");
  });

  it("se deshabilita junto con el campo", () => {
    expect(FUENTE).toContain("disabled={props.disabled}");
  });
});
