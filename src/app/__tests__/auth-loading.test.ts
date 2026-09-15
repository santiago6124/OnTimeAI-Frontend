/**
 * Las rutas de acceso no pueden caer en el estado de carga del dashboard.
 *
 * `src/app/loading.tsx` renderiza `<AppShell>` —barra lateral y encabezado del
 * tablero— y en Next eso aplica a TODA ruta que no tenga el suyo. Al navegar
 * entre `/login` y `/signup` se veía el dashboard completo por un instante,
 * con sesión o sin ella, antes de llegar a un formulario.
 *
 * Se verifica sobre los archivos porque el defecto es de estructura: no hay
 * render que lo exponga, solo la ausencia de un archivo.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(process.cwd(), "src", "app");

describe("estados de carga de las rutas de acceso", () => {
  it("el loading raíz sigue importando AppShell", () => {
    // Si algún día deja de hacerlo, estos tests sobran y conviene saberlo.
    const raiz = readFileSync(join(APP, "loading.tsx"), "utf8");
    expect(raiz).toMatch(/import .*AppShell.* from/);
  });

  it.each(["login", "signup"])("/%s tiene su propio loading", (ruta) => {
    expect(existsSync(join(APP, ruta, "loading.tsx"))).toBe(true);
  });

  it.each(["login", "signup"])("el loading de /%s no trae el chrome", (ruta) => {
    // Se mira el import y no la palabra: el comentario de esos archivos
    // nombra a `AppShell` justamente para explicar por qué no lo usan.
    const contenido = readFileSync(join(APP, ruta, "loading.tsx"), "utf8");
    expect(contenido).not.toMatch(/import .*AppShell.* from/);
    expect(contenido).not.toMatch(/<AppShell/);
  });
});
