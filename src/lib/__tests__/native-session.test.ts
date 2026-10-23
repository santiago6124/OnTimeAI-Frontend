/**
 * CP-COB-FE-17 — `src/lib/native/session.ts`: el token del bundle nativo en
 * `@capacitor/preferences`, con su caché en memoria.
 *
 * Lo que garantiza: la primera lectura va al puente y las siguientes no;
 * guardar y borrar actualizan la caché aunque el puente falle (la sesión en
 * curso sigue viva); y sin puente —el bundle abierto en un navegador— no hay
 * sesión, no un error.
 *
 * El módulo guarda estado, así que cada caso lo importa fresco.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const puente = vi.hoisted(() => ({
  datos: new Map<string, string>(),
  falla: false,
  llamadas: 0,
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => {
      puente.llamadas += 1;
      if (puente.falla) throw new Error("Preferences no está implementado");
      return { value: puente.datos.get(key) ?? null };
    },
    set: async ({ key, value }: { key: string; value: string }) => {
      puente.llamadas += 1;
      if (puente.falla) throw new Error("Preferences no está implementado");
      puente.datos.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      puente.llamadas += 1;
      if (puente.falla) throw new Error("Preferences no está implementado");
      puente.datos.delete(key);
    },
  },
}));

const CLAVE = "ontimeai.auth.token";

async function sesion() {
  vi.resetModules();
  return import("@/lib/native/session");
}

beforeEach(() => {
  puente.datos.clear();
  puente.falla = false;
  puente.llamadas = 0;
});

describe("loadToken", () => {
  it("sin nada guardado es null, y lo recuerda sin volver al puente", async () => {
    // Arrange
    const { loadToken } = await sesion();

    // Act
    const primera = await loadToken();
    const segunda = await loadToken();

    // Assert
    expect(primera).toBeNull();
    expect(segunda).toBeNull();
    expect(puente.llamadas).toBe(1);
  });

  it("lee el token persistido bajo la clave propia", async () => {
    puente.datos.set(CLAVE, "jwt-guardado");
    const { loadToken } = await sesion();

    await expect(loadToken()).resolves.toBe("jwt-guardado");
  });

  it("sin puente nativo no hay sesión, no un error", async () => {
    puente.falla = true;
    const { loadToken } = await sesion();

    await expect(loadToken()).resolves.toBeNull();
  });
});

describe("saveToken y clearToken", () => {
  it("guardar persiste y deja el token en caché", async () => {
    const { saveToken, loadToken } = await sesion();

    await saveToken("jwt-nuevo");

    expect(puente.datos.get(CLAVE)).toBe("jwt-nuevo");
    await expect(loadToken()).resolves.toBe("jwt-nuevo");
    expect(puente.llamadas).toBe(1);
  });

  it("borrar quita el token del almacenamiento y de la caché", async () => {
    puente.datos.set(CLAVE, "jwt-viejo");
    const { clearToken, loadToken } = await sesion();

    await clearToken();

    expect(puente.datos.has(CLAVE)).toBe(false);
    await expect(loadToken()).resolves.toBeNull();
  });

  it("si el puente falla, el token igual vive en memoria hasta cerrar la app", async () => {
    puente.falla = true;
    const { saveToken, clearToken, loadToken } = await sesion();

    await expect(saveToken("jwt-memoria")).resolves.toBeUndefined();
    await expect(loadToken()).resolves.toBe("jwt-memoria");
    await expect(clearToken()).resolves.toBeUndefined();
    await expect(loadToken()).resolves.toBeNull();
  });
});
