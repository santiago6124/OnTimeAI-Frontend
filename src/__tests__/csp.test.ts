/**
 * La CSP tiene que permitir los orígenes que la app realmente llama.
 *
 * Es la clase de error que no aparece en ningún test ni en el build: el
 * navegador bloquea la llamada en producción y el mensaje que ve la persona
 * apunta al lugar equivocado —"No se pudo conectar", como si fuera su wifi—.
 * Pasó el 15/09 con Firebase, que quedó afuera de `connect-src`.
 *
 * Cada origen de acá abajo está porque hay código que le habla. Si se quita esa
 * integración, se quita la línea; mientras exista, la CSP no puede olvidarla.
 */
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

/** Origen → quién lo llama, para que al romperse se sepa qué se apagó. */
const CONNECT_SRC = [
  ["https://identitytoolkit.googleapis.com", "Firebase: alta, ingreso y envío de correos"],
  ["https://securetoken.googleapis.com", "Firebase: renovación del ID token"],
  ["https://accounts.google.com/gsi/", "Google Identity Services: el botón"],
] as const;

async function directivas(): Promise<Map<string, string[]>> {
  const headers = await nextConfig.headers!();
  const csp = headers
    .flatMap((h) => h.headers)
    .find((h) => h.key === "Content-Security-Policy");
  if (!csp) throw new Error("no hay Content-Security-Policy configurada");

  return new Map(
    csp.value.split(";").map((d) => {
      const [nombre, ...valores] = d.trim().split(/\s+/);
      return [nombre, valores];
    }),
  );
}

describe("Content-Security-Policy", () => {
  it.each(CONNECT_SRC)("permite conectarse a %s (%s)", async (origen) => {
    const connectSrc = (await directivas()).get("connect-src") ?? [];
    expect(connectSrc).toContain(origen);
  });

  it("deja cargar los tiles de Esri que usan los mapas", async () => {
    // Estuvo bloqueado hasta el 18/09: los vuelos se dibujaban sobre gris.
    const imgSrc = (await directivas()).get("img-src") ?? [];
    expect(imgSrc).toContain("https://server.arcgisonline.com");
  });

  it("sigue cargando el script de Google Identity Services", async () => {
    const scriptSrc = (await directivas()).get("script-src") ?? [];
    expect(scriptSrc).toContain("https://accounts.google.com/gsi/client");
  });

  it("no se abre a cualquier origen para tapar un bloqueo", async () => {
    // El atajo cuando algo se bloquea es poner `*` y seguir. Que falle acá.
    const todas = await directivas();
    for (const clave of ["connect-src", "script-src", "frame-src", "default-src"]) {
      expect(todas.get(clave) ?? []).not.toContain("*");
    }
  });
});
