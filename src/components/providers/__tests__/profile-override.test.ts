/**
 * Cambiar el perfil en Ajustes tiene que verse.
 *
 * Había dos controles: el perfil de la cuenta (Viajero / Operaciones, guardado
 * en el servidor) y un "cambio de vista" local que la propia pantalla describe
 * como *temporal, solo en este navegador, para demos*.
 *
 * No era temporal. El valor local le gana al de la cuenta:
 *
 *     profile = canSelectProfile
 *       ? storedProfile ?? accountProfile ?? DEFAULT_PROFILE
 *       : accountProfile ?? "passenger";
 *
 * y el desplegable solo ofrecía los dos perfiles, nunca "seguir mi cuenta".
 * Un admin que lo abriera una vez quedaba con la vista congelada en ese
 * navegador, y cambiar el perfil en Ajustes no hacía nada visible.
 *
 * Se verifica sobre la fuente porque lo que falla es la precedencia entre dos
 * piezas que viven en archivos distintos, y ningún render de un componente
 * solo lo expone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const PROVIDER = readFileSync(
  join(raiz, "src", "components", "providers", "profile-provider.tsx"),
  "utf8",
);
const SWITCHER = readFileSync(
  join(raiz, "src", "components", "profile-switcher.tsx"),
  "utf8",
);
const AJUSTES = readFileSync(
  join(raiz, "src", "app", "settings", "page.tsx"),
  "utf8",
);

describe("el override local se puede soltar", () => {
  it("setProfile acepta null para volver a seguir la cuenta", () => {
    expect(PROVIDER).toMatch(/setProfile:\s*\(profile:\s*ProfileId\s*\|\s*null\)/);
  });

  it("y null BORRA la cookie en vez de guardar un valor", () => {
    // El override pasó de `localStorage` a una cookie para que el servidor
    // también lo vea: la home es un Server Component y decide qué árbol
    // dibujar según el perfil. Borrar es poner una fecha pasada.
    expect(PROVIDER).toContain("expires=Thu, 01 Jan 1970");
    expect(PROVIDER).toContain("writeCookie(next)");
  });

  it("el servidor lee el mismo override que el cliente", () => {
    // Si las dos piezas leyeran lugares distintos, la misma pantalla
    // terminaría con el menú de un perfil y el contenido del otro.
    const servidor = readFileSync(
      join(raiz, "src", "lib", "server-profile.ts"),
      "utf8",
    );
    expect(servidor).toContain('"ontimeai-profile"');
    expect(PROVIDER).toContain('STORAGE_KEY = "ontimeai-profile"');
  });

  it("expone si hay un override activo, para poder decirlo en pantalla", () => {
    expect(PROVIDER).toMatch(/overridden:/);
  });
});

describe("el desplegable ofrece el camino de vuelta", () => {
  it("tiene una opción para seguir la cuenta", () => {
    expect(SWITCHER).toContain("Seguir mi cuenta");
  });

  it("que limpia el override", () => {
    expect(SWITCHER).toContain("setProfile(null)");
  });
});

describe("cambiar el perfil de la cuenta se ve", () => {
  it("limpia el override antes de recargar", () => {
    // El orden importa: si el override sobrevive a la recarga, le gana al
    // perfil recién elegido y el cambio queda invisible.
    const i = AJUSTES.indexOf("setProfile(null)");
    const j = AJUSTES.indexOf("window.location.reload()");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
  });

  it("avisa en pantalla cuando hay una vista fijada", () => {
    expect(AJUSTES).toContain("overridden");
    expect(AJUSTES).toMatch(/vista fijada/i);
  });
});
