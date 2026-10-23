/**
 * Sign in with Apple en el bundle de iOS.
 *
 * Ni la hoja de Apple ni Firebase se pueden probar sin un teléfono. Lo que sí
 * se fija acá es lo que se rompe en silencio:
 *
 * - **El gate.** El plugin ya está en el binario 1.1.0 (7), que NO tiene el
 *   entitlement. Si el gate mirara solo el plugin, un OTA le dibujaría a ese
 *   binario un botón que falla con `AuthorizationError 1000`. Por eso exige la
 *   marca que `ios-patch-apple.sh` pone en el user agent. Y nunca en Android
 *   ni en la web, que cargan este mismo JS.
 * - **El nonce.** A Apple va el SHA-256 y a Firebase el crudo. Cruzarlos da
 *   `auth/invalid-credential` sin más pista.
 * - **La baja.** Cancelar la confirmación de Apple frena la baja; cualquier
 *   otra falla de la revocación no la frena.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const UA_CON_MARCA = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 OnTimeAI-SIWA/1";
const UA_SIN_MARCA = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15";

type Escenario = {
  plataforma?: string;
  plugin?: boolean;
  userAgent?: string;
  login?: () => Promise<unknown>;
};

const espias = {
  login: vi.fn(),
  initialize: vi.fn(),
  logout: vi.fn(),
};

async function cargar(e: Escenario = {}) {
  const { plataforma = "ios", plugin = true, userAgent = UA_CON_MARCA } = e;
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent });
  vi.doMock("@capacitor/core", () => ({
    Capacitor: {
      getPlatform: () => plataforma,
      isPluginAvailable: (n: string) => plugin && n === "SocialLogin",
    },
  }));
  espias.login.mockImplementation(
    e.login ??
      (async () => ({
        provider: "apple",
        result: {
          idToken: "id-token-de-apple",
          accessToken: { token: "codigo-de-apple" },
          profile: { user: "u", email: "", givenName: "", familyName: "" },
        },
      })),
  );
  espias.initialize.mockResolvedValue(undefined);
  espias.logout.mockResolvedValue(undefined);
  vi.doMock("@capgo/capacitor-social-login", () => ({
    SocialLogin: {
      initialize: espias.initialize,
      login: espias.login,
      logout: espias.logout,
    },
  }));
  return import("@/lib/native/apple-sign-in");
}

beforeEach(() => {
  Object.values(espias).forEach((s) => s.mockReset());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock("@capacitor/core");
  vi.doUnmock("@capgo/capacitor-social-login");
});

describe("appleDisponibleEn", () => {
  it("en iOS con la marca del binario, sí", async () => {
    const { appleDisponibleEn } = await cargar();
    expect(appleDisponibleEn("ios", UA_CON_MARCA)).toBe(true);
  });

  it("en iOS SIN la marca, no: es el binario 1.1.0 (7), sin entitlement", async () => {
    const { appleDisponibleEn } = await cargar();
    expect(appleDisponibleEn("ios", UA_SIN_MARCA)).toBe(false);
  });

  it("nunca en Android ni en la web, aunque el user agent tenga la marca", async () => {
    const { appleDisponibleEn } = await cargar();
    expect(appleDisponibleEn("android", UA_CON_MARCA)).toBe(false);
    expect(appleDisponibleEn("web", UA_CON_MARCA)).toBe(false);
  });

  it("la marca es la que escribe el parche nativo", async () => {
    // Si alguien cambia una sin la otra, el botón no aparece nunca.
    const { MARCA_USER_AGENT } = await cargar();
    const { readFileSync } = await import("node:fs");
    const parche = readFileSync("scripts/ios-patch-apple.sh", "utf8");
    expect(parche).toContain(`MARCA="${MARCA_USER_AGENT}"`);
  });
});

describe("appleNativoListo", () => {
  it("con plataforma, marca y plugin, está listo", async () => {
    const { appleNativoListo } = await cargar();
    await expect(appleNativoListo()).resolves.toBe(true);
  });

  it("sin la marca no está listo aunque el plugin esté", async () => {
    // El caso del OTA nuevo sobre el binario viejo.
    const { appleNativoListo } = await cargar({ userAgent: UA_SIN_MARCA });
    await expect(appleNativoListo()).resolves.toBe(false);
  });

  it("sin el plugin no está listo aunque esté la marca", async () => {
    const { appleNativoListo } = await cargar({ plugin: false });
    await expect(appleNativoListo()).resolves.toBe(false);
  });

  it("en Android no está listo", async () => {
    const { appleNativoListo } = await cargar({ plataforma: "android" });
    await expect(appleNativoListo()).resolves.toBe(false);
  });

  it("sin navigator (render del servidor) no está listo", async () => {
    const mod = await cargar();
    vi.stubGlobal("navigator", undefined);
    await expect(mod.appleNativoListo()).resolves.toBe(false);
  });
});

describe("nonce", () => {
  // Vectores de FIPS 180-2.
  const VECTORES: [string, string][] = [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
  ];

  it("genera 64 caracteres hex distintos cada vez", async () => {
    const { generarNonce } = await cargar();
    const a = generarNonce();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(generarNonce()).not.toBe(a);
  });

  it.each(VECTORES)("sha256Hex(%j) con crypto.subtle", async (entrada, esperado) => {
    const { sha256Hex } = await cargar();
    await expect(sha256Hex(entrada)).resolves.toBe(esperado);
  });

  it.each(VECTORES)("el respaldo en JS da lo mismo para %j", async (entrada, esperado) => {
    const { sha256HexEnJs } = await cargar();
    expect(sha256HexEnJs(new TextEncoder().encode(entrada))).toBe(esperado);
  });

  it("sin crypto.subtle usa el respaldo", async () => {
    const { sha256Hex } = await cargar();
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    await expect(sha256Hex("abc")).resolves.toBe(VECTORES[1][1]);
  });

  it("el respaldo maneja entradas de más de un bloque", async () => {
    const { sha256HexEnJs } = await cargar();
    const { createHash } = await import("node:crypto");
    const larga = "x".repeat(1000);
    expect(sha256HexEnJs(new TextEncoder().encode(larga))).toBe(
      createHash("sha256").update(larga).digest("hex"),
    );
  });
});

describe("pedirCredencialDeApple", () => {
  it("a Apple le pasa el HASH del nonce y devuelve el CRUDO", async () => {
    const { pedirCredencialDeApple, sha256Hex } = await cargar();
    const credencial = await pedirCredencialDeApple();

    const opciones = espias.login.mock.calls[0][0];
    expect(opciones.provider).toBe("apple");
    expect(opciones.options.nonce).toBe(await sha256Hex(credencial.rawNonce));
    expect(opciones.options.nonce).not.toBe(credencial.rawNonce);
    expect(credencial).toMatchObject({ idToken: "id-token-de-apple", codigo: "codigo-de-apple" });
  });

  it("inicializa sin redirectUrl y en modo legado, que es el que devuelve el código", async () => {
    const { pedirCredencialDeApple } = await cargar();
    await pedirCredencialDeApple();
    expect(espias.initialize).toHaveBeenCalledWith({
      apple: { redirectUrl: "", useProperTokenExchange: false },
    });
  });

  it("borra el estado que el plugin guarda en UserDefaults", async () => {
    const { pedirCredencialDeApple } = await cargar();
    await pedirCredencialDeApple();
    expect(espias.logout).toHaveBeenCalledWith({ provider: "apple" });
  });

  it("sin gate no abre la hoja", async () => {
    const { pedirCredencialDeApple } = await cargar({ userAgent: UA_SIN_MARCA });
    await expect(pedirCredencialDeApple()).rejects.toThrow(/no está disponible/);
    expect(espias.login).not.toHaveBeenCalled();
  });

  it("distingue el cancelar de la hoja (1001) de una falla", async () => {
    const { pedirCredencialDeApple } = await cargar({
      login: async () => {
        throw new Error(
          "The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)",
        );
      },
    });
    await expect(pedirCredencialDeApple()).rejects.toMatchObject({ cancelado: true });
  });

  it("el 1000 (sin entitlement) no es un cancelar", async () => {
    const { pedirCredencialDeApple } = await cargar({
      login: async () => {
        throw new Error("(com.apple.AuthenticationServices.AuthorizationError error 1000.)");
      },
    });
    await expect(pedirCredencialDeApple()).rejects.toMatchObject({
      name: "AppleNativoError",
      cancelado: false,
    });
  });

  it("sin identity token falla con un mensaje legible", async () => {
    const { pedirCredencialDeApple } = await cargar({
      login: async () => ({ provider: "apple", result: { idToken: "", accessToken: null } }),
    });
    await expect(pedirCredencialDeApple()).rejects.toThrow(/no devolvió una credencial/);
  });

  it("sin código devuelve null, no una cadena vacía", async () => {
    const { pedirCredencialDeApple } = await cargar({
      login: async () => ({ provider: "apple", result: { idToken: "t", accessToken: null } }),
    });
    await expect(pedirCredencialDeApple()).resolves.toMatchObject({ codigo: null });
  });
});

// --- auth-apple.ts ------------------------------------------------------------

type EscenarioBaja = Escenario & {
  proveedores?: string[];
  usuario?: boolean;
  reauthOk?: boolean;
  revocarStatus?: number;
};

const firebase = {
  credential: vi.fn(),
  reauth: vi.fn(),
  signIn: vi.fn(),
  fetch: vi.fn(),
  canje: vi.fn(),
};

async function cargarAuth(e: EscenarioBaja = {}) {
  const { proveedores = ["apple.com"], usuario = true, reauthOk = true, revocarStatus = 200 } = e;
  await cargar(e);
  firebase.credential.mockImplementation((o: unknown) => ({ apple: o }));
  firebase.reauth.mockImplementation(async () => {
    if (!reauthOk) throw Object.assign(new Error("x"), { code: "auth/user-mismatch" });
    return { user: { getIdToken: async () => "id-token-firebase" } };
  });
  firebase.signIn.mockResolvedValue({ user: { getIdToken: async () => "id-token-firebase" } });
  firebase.fetch.mockResolvedValue({ ok: revocarStatus < 400, status: revocarStatus });
  firebase.canje.mockResolvedValue({ username: "a@privaterelay.appleid.com", isNewUser: true });
  vi.stubGlobal("fetch", firebase.fetch);
  vi.doMock("firebase/auth", () => ({
    OAuthProvider: class {
      constructor(readonly id: string) {}
      credential(o: unknown) {
        return firebase.credential({ proveedor: this.id, ...(o as object) });
      }
    },
    reauthenticateWithCredential: firebase.reauth,
    signInWithCredential: firebase.signIn,
  }));
  const auth = {
    config: { apiKey: "clave-publica" },
    authStateReady: async () => undefined,
    currentUser: usuario
      ? { providerData: proveedores.map((providerId) => ({ providerId })) }
      : null,
  };
  vi.doMock("@/lib/firebase", () => ({ firebaseAuth: () => auth }));
  vi.doMock("@/lib/api", () => ({ apiLoginFirebase: firebase.canje }));
  return import("@/lib/auth-apple");
}

describe("sesionConAppleNativo", () => {
  beforeEach(() => Object.values(firebase).forEach((s) => s.mockReset()));

  it("arma la credencial de apple.com con el nonce CRUDO y canjea en /auth/firebase", async () => {
    const { sesionConAppleNativo } = await cargarAuth();
    const sesion = await sesionConAppleNativo();

    const credencial = firebase.credential.mock.calls[0][0];
    expect(credencial.proveedor).toBe("apple.com");
    expect(credencial.idToken).toBe("id-token-de-apple");
    // El que va a Apple es el hash; a Firebase, el crudo.
    expect(credencial.rawNonce).not.toBe(espias.login.mock.calls[0][0].options.nonce);
    expect(firebase.canje).toHaveBeenCalledWith("id-token-firebase");
    expect(sesion.isNewUser).toBe(true);
  });
});

describe("revocarAppleAntesDeBorrar", () => {
  beforeEach(() => Object.values(firebase).forEach((s) => s.mockReset()));

  it("con cuenta de Apple: reautentica y revoca el código como CODE", async () => {
    const { revocarAppleAntesDeBorrar } = await cargarAuth();
    await expect(revocarAppleAntesDeBorrar()).resolves.toBe(true);

    const [url, init] = firebase.fetch.mock.calls[0];
    expect(url).toBe(
      "https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=clave-publica",
    );
    expect(JSON.parse(init.body)).toEqual({
      providerId: "apple.com",
      tokenType: "CODE",
      token: "codigo-de-apple",
      idToken: "id-token-firebase",
    });
    expect(firebase.signIn).not.toHaveBeenCalled();
  });

  it("sin Apple en la cuenta no pide nada", async () => {
    const { revocarAppleAntesDeBorrar } = await cargarAuth({ proveedores: ["password"] });
    await expect(revocarAppleAntesDeBorrar()).resolves.toBe(false);
    expect(espias.login).not.toHaveBeenCalled();
  });

  it("sin sesión de Firebase no pide nada", async () => {
    const { revocarAppleAntesDeBorrar } = await cargarAuth({ usuario: false });
    await expect(revocarAppleAntesDeBorrar()).resolves.toBe(false);
    expect(espias.login).not.toHaveBeenCalled();
  });

  it("fuera del binario con entitlement no hace nada", async () => {
    const { revocarAppleAntesDeBorrar } = await cargarAuth({ plataforma: "android" });
    await expect(revocarAppleAntesDeBorrar()).resolves.toBe(false);
    expect(espias.login).not.toHaveBeenCalled();
  });

  it("si el usuario cancela la hoja, TIRA: la baja no sigue", async () => {
    const { revocarAppleAntesDeBorrar } = await cargarAuth({
      login: async () => {
        throw new Error("AuthorizationError error 1001.");
      },
    });
    await expect(revocarAppleAntesDeBorrar()).rejects.toMatchObject({ cancelado: true });
  });

  it("si Apple falla por otra cosa, la baja sigue sin revocar", async () => {
    const { revocarAppleAntesDeBorrar } = await cargarAuth({
      login: async () => {
        throw new Error("AuthorizationError error 1000.");
      },
    });
    await expect(revocarAppleAntesDeBorrar()).resolves.toBe(false);
  });

  it("si Firebase no tiene la clave de Apple (revokeToken 400), la baja sigue", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { revocarAppleAntesDeBorrar } = await cargarAuth({ revocarStatus: 400 });
    await expect(revocarAppleAntesDeBorrar()).resolves.toBe(false);
  });

  it("otro Apple ID (user-mismatch) no revoca nada", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { revocarAppleAntesDeBorrar } = await cargarAuth({ reauthOk: false });
    await expect(revocarAppleAntesDeBorrar()).resolves.toBe(false);
    expect(firebase.fetch).not.toHaveBeenCalled();
  });

  it("sin código de autorización no intenta revocar", async () => {
    const { revocarAppleAntesDeBorrar } = await cargarAuth({
      login: async () => ({ provider: "apple", result: { idToken: "t", accessToken: null } }),
    });
    await expect(revocarAppleAntesDeBorrar()).resolves.toBe(false);
    expect(firebase.fetch).not.toHaveBeenCalled();
  });
});

describe("mensajeDeErrorDeApple", () => {
  it("el correo ya usado por otro método dice cómo entrar", async () => {
    const { mensajeDeErrorDeApple } = await cargarAuth();
    expect(
      mensajeDeErrorDeApple({ code: "auth/account-exists-with-different-credential" }),
    ).toMatch(/Ya tenés una cuenta con ese correo/);
  });

  it("los errores propios y del backend pasan con su texto", async () => {
    const { mensajeDeErrorDeApple } = await cargarAuth();
    const { AppleNativoError } = await import("@/lib/native/apple-sign-in");
    expect(mensajeDeErrorDeApple(new AppleNativoError("Cancelaste."))).toBe("Cancelaste.");
    expect(mensajeDeErrorDeApple(new Error("Falta verificar el correo."))).toBe(
      "Falta verificar el correo.",
    );
  });

  it("un código de Firebase desconocido da el genérico", async () => {
    const { mensajeDeErrorDeApple } = await cargarAuth();
    expect(mensajeDeErrorDeApple({ code: "auth/otra-cosa" })).toBe(
      "No se pudo iniciar sesión con Apple.",
    );
  });
});
