/**
 * CP-COB-FE-14 — `src/lib/firebase.ts`: la instancia de Auth y la traducción
 * de los códigos de error de Firebase.
 *
 * Lo que garantiza: en la web `getAuth` sobre una app única (dos llamadas no
 * inicializan dos veces); en el bundle `initializeAuth` sin resolver de
 * popups, también una sola vez; y que cada código de error llegue al
 * formulario como una frase legible, con un mensaje genérico para lo demás.
 *
 * El SDK de Firebase se simula entero: no hay red ni IndexedDB acá.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  apps: [] as Array<{ options: { projectId: string } }>,
  useDeviceLanguage: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  initializeAuth: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  getApps: () => sdk.apps,
  initializeApp: (options: { projectId: string }) => {
    sdk.initializeApp(options);
    const app = { options };
    sdk.apps.push(app);
    return app;
  },
}));

vi.mock("firebase/auth", () => ({
  indexedDBLocalPersistence: { type: "LOCAL" },
  getAuth: (app: unknown) => {
    sdk.getAuth(app);
    return { app, useDeviceLanguage: sdk.useDeviceLanguage };
  },
  initializeAuth: (app: unknown, deps: unknown) => {
    sdk.initializeAuth(app, deps);
    return { app, deps, useDeviceLanguage: sdk.useDeviceLanguage };
  },
}));

beforeEach(() => {
  sdk.apps.length = 0;
  sdk.useDeviceLanguage.mockClear();
  sdk.initializeApp.mockClear();
  sdk.getAuth.mockClear();
  sdk.initializeAuth.mockClear();
});

afterEach(() => {
  vi.doUnmock("@/lib/mobile-env");
  vi.resetModules();
});

describe("mensajeDeError", () => {
  it.each([
    ["auth/email-already-in-use", "Ya existe una cuenta con ese correo. Probá ingresar."],
    ["auth/invalid-email", "El correo no parece válido."],
    ["auth/weak-password", "La contraseña es demasiado corta."],
    ["auth/invalid-credential", "El correo o la contraseña no coinciden."],
    ["auth/wrong-password", "El correo o la contraseña no coinciden."],
    ["auth/user-not-found", "El correo o la contraseña no coinciden."],
    ["auth/too-many-requests", "Demasiados intentos. Esperá unos minutos y volvé a probar."],
    ["auth/network-request-failed", "No se pudo conectar. Revisá tu conexión."],
    ["auth/unauthorized-domain", "Este dominio no está autorizado para iniciar sesión."],
  ])("%s → %s", async (code, mensaje) => {
    const { mensajeDeError } = await import("@/lib/firebase");
    expect(mensajeDeError({ code })).toBe(mensaje);
  });

  it.each([
    ["un código desconocido", { code: "auth/algo-nuevo" }],
    ["un Error sin code", new Error("boom")],
    ["null", null],
    ["un string", "auth/invalid-email"],
  ])("ante %s cae en el mensaje genérico", async (_caso, error) => {
    const { mensajeDeError } = await import("@/lib/firebase");
    expect(mensajeDeError(error)).toBe("No se pudo completar la operación. Probá de nuevo.");
  });
});

describe("firebaseAuth en la web", () => {
  it("inicializa la app del proyecto una sola vez y usa el idioma del dispositivo", async () => {
    // Arrange
    const { firebaseAuth } = await import("@/lib/firebase");

    // Act
    const primera = firebaseAuth();
    const segunda = firebaseAuth();

    // Assert
    expect(sdk.initializeApp).toHaveBeenCalledTimes(1);
    expect(sdk.initializeApp.mock.calls[0][0].projectId).toBe("ontimeai-prod");
    expect(sdk.getAuth).toHaveBeenCalledTimes(2);
    expect(sdk.initializeAuth).not.toHaveBeenCalled();
    expect(sdk.useDeviceLanguage).toHaveBeenCalledTimes(2);
    expect(primera.app).toBe(segunda.app);
  });
});

describe("firebaseAuth en el bundle de iOS", () => {
  it("usa initializeAuth sin resolver de popups, una sola vez", async () => {
    vi.doMock("@/lib/mobile-env", () => ({ IS_BUNDLED: true }));
    const { firebaseAuth } = await import("@/lib/firebase");

    firebaseAuth();
    firebaseAuth();

    expect(sdk.getAuth).not.toHaveBeenCalled();
    expect(sdk.initializeAuth).toHaveBeenCalledTimes(1);
    expect(sdk.initializeAuth.mock.calls[0][1]).toEqual({ persistence: { type: "LOCAL" } });
    expect(sdk.useDeviceLanguage).toHaveBeenCalledTimes(2);
  });
});
