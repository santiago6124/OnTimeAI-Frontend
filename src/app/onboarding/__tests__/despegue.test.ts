/**
 * El despegue de la elección de perfil.
 *
 * Una animación que referencia una `@keyframes` que no existe no falla: no
 * hace nada. El build pasa, el navegador no se queja, y el efecto simplemente
 * no está. Renombrar una keyframe en globals.css sin tocar la página, o al
 * revés, deja justo ese silencio.
 *
 * Por eso el caso que importa acá es el cruce entre los dos archivos. Lo demás
 * son las propiedades que hacen que esto sea un botón y no un dibujo.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGINA = readFileSync(
  join(process.cwd(), "src", "app", "onboarding", "page.tsx"),
  "utf8",
);
const CSS = readFileSync(
  join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);

/** Los nombres que la página le pide a Tailwind vía `animate-[nombre_...]`. */
const referenciadas = [
  ...PAGINA.matchAll(/animate-\[([a-z-]+)_/g),
].map((m) => m[1]);

describe("las animaciones del despegue", () => {
  it("la página referencia al menos una", () => {
    // Si alguien saca el efecto entero, este archivo sobra y conviene saberlo
    // acá y no por un test que pasa sin mirar nada.
    expect(referenciadas.length).toBeGreaterThan(0);
  });

  it.each([...new Set(referenciadas)])(
    "`%s` está definida en globals.css",
    (nombre) => {
      // Se exige hasta la llave: un limite de palabra daria por buena una
      // keyframe renombrada a `ontime-despegue-otra`, porque el guion ya
      // cuenta como limite y el nombre viejo matchearia igual.
      expect(CSS).toMatch(new RegExp(`@keyframes\\s+${nombre}\\s*\\{`));
    },
  );

  it("la clase de la pista existe en el CSS", () => {
    expect(PAGINA).toContain("ontime-pista");
    expect(CSS).toMatch(/\.ontime-pista\s*\{/);
  });
});

describe("la elección de perfil es un botón", () => {
  it("cada opción es un <button> de tipo button", () => {
    // Si fuera un div, no entra por teclado ni lo anuncia un lector de pantalla.
    expect(PAGINA).toContain('type="button"');
  });

  it("responde al mouse y al foco de teclado", () => {
    expect(PAGINA).toContain("hover:");
    expect(PAGINA).toContain("focus-visible:ring-primary");
  });

  it("se deshabilita mientras guarda", () => {
    expect(PAGINA).toContain("disabled={isPending}");
    expect(PAGINA).toContain("aria-busy={despega}");
  });
});

describe("el despegue no le cuesta tiempo a nadie", () => {
  it("la animación corre en paralelo con la llamada, no antes", () => {
    // En serie sumaría su duración entera a la espera. `Promise.all` la mete
    // dentro del tiempo que el backend ya tarda.
    expect(PAGINA).toMatch(/await Promise\.all\(\[\s*apiSetUserType/);
  });

  it("quien pidió menos movimiento no espera la animación", () => {
    // Sin esto la espera queda igual frente a una pantalla que no se mueve.
    expect(PAGINA).toContain("prefers-reduced-motion: reduce");
    expect(PAGINA).toMatch(/quiereMenosMovimiento\(\)\s*\?\s*Promise\.resolve\(\)/);
  });
});
