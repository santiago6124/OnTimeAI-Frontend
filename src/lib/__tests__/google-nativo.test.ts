/**
 * El gate del login con Google nativo.
 *
 * Es lo único de esta función que se puede probar sin un teléfono: el plugin
 * abre una hoja nativa y Firebase verifica una credencial de verdad, así que
 * ni uno ni otro se simulan con provecho. Lo que sí se puede fijar —y es donde
 * ya me equivoqué una vez— es **qué credenciales necesita cada plataforma**.
 *
 * El error era pedir el client ID de iOS también en Android. Android no tiene
 * client ID propio: se identifica por su package name y la huella SHA-1 de la
 * firma, que se registran en la consola y no viajan en el código. Con el gate
 * equivocado el botón quedaba escondido en Android para siempre, porque el
 * deploy de la web —que es lo que el shell de Android carga— no tiene por qué
 * conocer un client ID de iOS.
 *
 * Es una falla silenciosa: la app sigue andando con correo y contraseña, así
 * que no hay ningún error que mirar. De ahí la prueba.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function conClientIds(ios: string, web: string) {
  vi.resetModules();
  vi.doMock("@/lib/mobile-env", () => ({
    IS_BUNDLED: true,
    API_ORIGIN: "https://backend.test",
    APP_ORIGIN: "https://app.test",
    REPORTS_ENABLED: false,
    GOOGLE_IOS_CLIENT_ID: ios,
    GOOGLE_WEB_CLIENT_ID: web,
    appPath: (p: string) => p,
  }));
  return import("@/lib/native/google-sign-in");
}

const IOS = "123-ios.apps.googleusercontent.com";
const WEB = "123-web.apps.googleusercontent.com";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/mobile-env");
});

describe("googleDisponibleEn", () => {
  it("en iOS pide los dos client IDs", async () => {
    const { googleDisponibleEn } = await conClientIds(IOS, WEB);
    expect(googleDisponibleEn("ios")).toBe(true);
  });

  it("en iOS no alcanza con el web: su esquema de URL sale del propio", async () => {
    const { googleDisponibleEn } = await conClientIds("", WEB);
    expect(googleDisponibleEn("ios")).toBe(false);
  });

  it("en iOS no alcanza con el propio: el web va como iOSServerClientId", async () => {
    const { googleDisponibleEn } = await conClientIds(IOS, "");
    expect(googleDisponibleEn("ios")).toBe(false);
  });

  it("en Android alcanza el web solo, SIN el de iOS", async () => {
    // La prueba del error: con la condición de iOS aplicada a Android, esto
    // daba false y el botón no aparecía nunca en el teléfono Android.
    const { googleDisponibleEn } = await conClientIds("", WEB);
    expect(googleDisponibleEn("android")).toBe(true);
  });

  it("en Android sin el web no hay con qué", async () => {
    const { googleDisponibleEn } = await conClientIds(IOS, "");
    expect(googleDisponibleEn("android")).toBe(false);
  });

  it("en web siempre es false: ese camino es Google Identity Services", async () => {
    // El botón de la web no pasa por el plugin. Si esto diera true, en el
    // navegador se dibujaría un botón que llama a un plugin que no existe.
    const { googleDisponibleEn } = await conClientIds(IOS, WEB);
    expect(googleDisponibleEn("web")).toBe(false);
  });
});

describe("pedirIdTokenDeGoogle", () => {
  it("falla con un mensaje legible si el build no tiene client IDs", async () => {
    const mod = await conClientIds("", "");
    await expect(mod.pedirIdTokenDeGoogle()).rejects.toThrow(
      /no está configurado/i,
    );
  });

  it("el error es de un tipo propio, para distinguirlo de uno de red", async () => {
    const mod = await conClientIds("", "");
    await expect(mod.pedirIdTokenDeGoogle()).rejects.toHaveProperty(
      "name",
      "GoogleNativoError",
    );
  });
});

describe("plataformaActual", () => {
  it("devuelve web cuando el puente de Capacitor no contesta", async () => {
    // Es el caso del navegador. Si esto tirara en vez de devolver "web", el
    // botón de la web se caería al montarse.
    const mod = await conClientIds(IOS, WEB);
    vi.doMock("@capacitor/core", () => {
      throw new Error("sin puente");
    });
    await expect(mod.plataformaActual()).resolves.toBe("web");
  });
});
