/**
 * La entrada con Face ID del bundle de iOS.
 *
 * Ni la cara ni Firebase se pueden probar sin un teléfono, pero lo que puede
 * salir mal de verdad no está ahí: está en **cuándo** se pide la cara. Lo que
 * fijan estas pruebas es eso.
 *
 * - Nunca fuera de iOS. Android carga esta misma web desde Cloud Run, así que
 *   un gate flojo le pide Face ID —o le dibuja una oferta— a un APK que no
 *   trae el plugin. Es el error que ya cometió el botón de Google.
 * - Nunca dos veces en el mismo arranque. Un fallo manda a /login con una
 *   recarga dura, /login vuelve a montar el gate, y sin la marca el usuario
 *   quedaría cancelando Face ID para siempre.
 * - Cualquier falla termina en el login normal, nunca en una excepción.
 * - El logout borra la elección y cierra Firebase, que con esto pasó a ser una
 *   credencial.
 *
 * Los plugins, Firebase y el canje se simulan con un escenario por prueba.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Escenario = {
  plataforma?: string;
  plugin?: boolean;
  disponible?: boolean;
  biometryType?: number;
  eleccion?: string | null;
  usuario?: boolean;
  caraOk?: boolean;
  canjeOk?: boolean;
  tokenOk?: boolean;
};

const preferencias = new Map<string, string>();
const sesion = new Map<string, string>();
const espias = {
  verificar: vi.fn(),
  canje: vi.fn(),
  getIdToken: vi.fn(),
  signOut: vi.fn(),
};

const CLAVE = "ontimeai.biometria.eleccion";

async function escenario(e: Escenario = {}) {
  const {
    plataforma = "ios",
    plugin = true,
    disponible = true,
    biometryType = 2,
    eleccion = "activada",
    usuario = true,
    caraOk = true,
    canjeOk = true,
    tokenOk = true,
  } = e;

  vi.resetModules();
  if (eleccion) preferencias.set(CLAVE, eleccion);

  vi.doMock("@capacitor/core", () => ({
    Capacitor: {
      getPlatform: () => plataforma,
      isPluginAvailable: (n: string) => plugin && n === "NativeBiometric",
    },
  }));
  vi.doMock("@capacitor/preferences", () => ({
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: preferencias.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => {
        preferencias.set(key, value);
      },
      remove: async ({ key }: { key: string }) => {
        preferencias.delete(key);
      },
    },
  }));
  espias.verificar.mockImplementation(async () => {
    if (!caraOk) throw new Error("USER_CANCEL");
  });
  vi.doMock("@capgo/capacitor-native-biometric", () => ({
    BiometryType: { TOUCH_ID: 1, FACE_ID: 2 },
    NativeBiometric: {
      isAvailable: async () => ({ isAvailable: disponible, biometryType }),
      verifyIdentity: espias.verificar,
    },
  }));
  espias.getIdToken.mockImplementation(async () => {
    if (!tokenOk) throw new Error("auth/user-token-expired");
    return "id-token-fresco";
  });
  const auth = {
    authStateReady: async () => undefined,
    currentUser: usuario ? { getIdToken: espias.getIdToken } : null,
  };
  vi.doMock("@/lib/firebase", () => ({ firebaseAuth: () => auth }));
  vi.doMock("firebase/auth", () => ({ signOut: espias.signOut }));
  espias.canje.mockImplementation(async () => {
    if (!canjeOk) throw new Error("503");
    return { username: "ana", role: "user", userType: "b2c", isNewUser: false };
  });
  vi.doMock("@/lib/api", () => ({ apiLoginFirebase: espias.canje }));

  return import("@/lib/native/biometria");
}

beforeEach(() => {
  preferencias.clear();
  sesion.clear();
  Object.values(espias).forEach((s) => s.mockReset());
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => sesion.get(k) ?? null,
    setItem: (k: string, v: string) => sesion.set(k, v),
    removeItem: (k: string) => sesion.delete(k),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("entrarConBiometria", () => {
  it("con todo en orden pide la cara, fuerza un token nuevo y lo canjea", async () => {
    const { entrarConBiometria } = await escenario();

    const usuario = await entrarConBiometria();

    expect(usuario).toEqual({ username: "ana", role: "user", userType: "b2c" });
    expect(espias.verificar).toHaveBeenCalledTimes(1);
    // `true`: el token cacheado puede estar vencido y el backend lo rechaza.
    expect(espias.getIdToken).toHaveBeenCalledWith(true);
    expect(espias.canje).toHaveBeenCalledWith("id-token-fresco");
  });

  it.each(["android", "web"])(
    "en %s no pide la cara aunque el plugin diga que está",
    async (plataforma) => {
      // El gate de plataforma. Si se rompe, esta prueba falla: el plugin se
      // registra con implementación web y en Android lo puede traer un APK.
      const { entrarConBiometria } = await escenario({ plataforma });

      await expect(entrarConBiometria()).resolves.toBeNull();
      expect(espias.verificar).not.toHaveBeenCalled();
    },
  );

  it("en un binario sin el plugin no pide nada", async () => {
    // Un bundle nuevo por OTA sobre el binario 1.0.0, que no trae el pod.
    const { entrarConBiometria } = await escenario({ plugin: false });
    await expect(entrarConBiometria()).resolves.toBeNull();
    expect(espias.verificar).not.toHaveBeenCalled();
  });

  it("sin Face ID configurado en el teléfono no pide nada", async () => {
    const { entrarConBiometria } = await escenario({ disponible: false });
    await expect(entrarConBiometria()).resolves.toBeNull();
    expect(espias.verificar).not.toHaveBeenCalled();
  });

  it.each([null, "rechazada"])(
    "si la elección es %s, no pide nada",
    async (eleccion) => {
      const { entrarConBiometria } = await escenario({ eleccion });
      await expect(entrarConBiometria()).resolves.toBeNull();
      expect(espias.verificar).not.toHaveBeenCalled();
    },
  );

  it("sin sesión de Firebase persistida no pide la cara: no habría qué canjear", async () => {
    const { entrarConBiometria } = await escenario({ usuario: false });
    await expect(entrarConBiometria()).resolves.toBeNull();
    expect(espias.verificar).not.toHaveBeenCalled();
  });

  it("si el usuario cancela, vuelve al login sin canjear", async () => {
    const { entrarConBiometria } = await escenario({ caraOk: false });
    await expect(entrarConBiometria()).resolves.toBeNull();
    expect(espias.getIdToken).not.toHaveBeenCalled();
    expect(espias.canje).not.toHaveBeenCalled();
  });

  it("si Firebase no renueva el token, vuelve al login sin tirar", async () => {
    const { entrarConBiometria } = await escenario({ tokenOk: false });
    await expect(entrarConBiometria()).resolves.toBeNull();
    expect(espias.canje).not.toHaveBeenCalled();
  });

  it("si el backend no canjea, vuelve al login sin tirar", async () => {
    const { entrarConBiometria } = await escenario({ canjeOk: false });
    await expect(entrarConBiometria()).resolves.toBeNull();
  });

  it("pide la cara una sola vez por arranque, aunque la página se recargue", async () => {
    const primero = await escenario({ caraOk: false });
    await primero.entrarConBiometria();

    // La recarga dura a /login: módulo nuevo, memoria en cero, mismo
    // sessionStorage. Sin la marca persistida, esto volvería a pedir la cara.
    const recargado = await escenario({ caraOk: false });
    await expect(recargado.entrarConBiometria()).resolves.toBeNull();

    expect(espias.verificar).toHaveBeenCalledTimes(1);
  });

  it("sin sessionStorage la marca en memoria igual evita el segundo pedido", async () => {
    vi.stubGlobal("sessionStorage", undefined);
    const { entrarConBiometria } = await escenario({ caraOk: false });
    await entrarConBiometria();
    await entrarConBiometria();
    expect(espias.verificar).toHaveBeenCalledTimes(1);
  });
});

describe("biometriaParaOfrecer", () => {
  it("ofrece una vez, cuando no hay elección guardada", async () => {
    const { biometriaParaOfrecer } = await escenario({ eleccion: null });
    await expect(biometriaParaOfrecer()).resolves.toBe("Face ID");
  });

  it("en un iPhone con Touch ID lo nombra como tal", async () => {
    const { biometriaParaOfrecer } = await escenario({ eleccion: null, biometryType: 1 });
    await expect(biometriaParaOfrecer()).resolves.toBe("Touch ID");
  });

  it.each(["activada", "rechazada"])("ya %s, no vuelve a ofrecer", async (eleccion) => {
    const { biometriaParaOfrecer } = await escenario({ eleccion });
    await expect(biometriaParaOfrecer()).resolves.toBeNull();
  });

  it("en Android no ofrece nada: la web remota no dibuja la tarjeta", async () => {
    const { biometriaParaOfrecer } = await escenario({ eleccion: null, plataforma: "android" });
    await expect(biometriaParaOfrecer()).resolves.toBeNull();
  });

  it("sin sesión de Firebase no ofrece algo que no podría funcionar", async () => {
    const { biometriaParaOfrecer } = await escenario({ eleccion: null, usuario: false });
    await expect(biometriaParaOfrecer()).resolves.toBeNull();
  });
});

describe("activar y desactivar", () => {
  it("activar pide la cara y recién ahí guarda", async () => {
    const { activarBiometria, leerEleccion } = await escenario({ eleccion: null });
    await expect(activarBiometria("Face ID")).resolves.toBe(true);
    await expect(leerEleccion()).resolves.toBe("activada");
  });

  it("si la cara no pasa al activar, no se guarda nada y la oferta sigue en pie", async () => {
    const { activarBiometria, leerEleccion } = await escenario({ eleccion: null, caraOk: false });
    await expect(activarBiometria("Face ID")).resolves.toBe(false);
    await expect(leerEleccion()).resolves.toBeNull();
  });

  it("desactivar guarda el rechazo, para no volver a ofrecer", async () => {
    const { desactivarBiometria, leerEleccion } = await escenario();
    await desactivarBiometria();
    await expect(leerEleccion()).resolves.toBe("rechazada");
  });

  it("un valor desconocido guardado se lee como sin elección", async () => {
    const { leerEleccion } = await escenario({ eleccion: "quizas" });
    await expect(leerEleccion()).resolves.toBeNull();
  });
});

describe("estadoDelAjuste", () => {
  it("en iOS con Face ID muestra el interruptor con el estado guardado", async () => {
    const { estadoDelAjuste } = await escenario();
    await expect(estadoDelAjuste()).resolves.toEqual({ tipo: "Face ID", activada: true });
  });

  it("en Android no hay interruptor", async () => {
    const { estadoDelAjuste } = await escenario({ plataforma: "android" });
    await expect(estadoDelAjuste()).resolves.toBeNull();
  });
});

describe("limpiarAlCerrarSesion", () => {
  it("borra la elección, cierra Firebase y habilita un nuevo intento", async () => {
    const mod = await escenario({ caraOk: false });
    await mod.entrarConBiometria();

    await mod.limpiarAlCerrarSesion();

    await expect(mod.leerEleccion()).resolves.toBeNull();
    expect(espias.signOut).toHaveBeenCalledTimes(1);
    expect(sesion.size).toBe(0);
  });

  it("que Firebase falle al cerrar no rompe el logout", async () => {
    const mod = await escenario();
    espias.signOut.mockRejectedValue(new Error("sin red"));
    await expect(mod.limpiarAlCerrarSesion()).resolves.toBeUndefined();
  });
});

describe("sin puente nativo", () => {
  it("todo degrada a 'no hay biometría' en vez de tirar", async () => {
    // El bundle abierto en un navegador de escritorio para depurar.
    vi.resetModules();
    vi.doMock("@capacitor/core", () => {
      throw new Error("sin puente");
    });
    vi.doMock("@capacitor/preferences", () => {
      throw new Error("sin puente");
    });
    vi.doMock("@capgo/capacitor-native-biometric", () => {
      throw new Error("sin puente");
    });
    const mod = await import("@/lib/native/biometria");

    await expect(mod.biometriaDisponible("ios")).resolves.toBeNull();
    await expect(mod.verificarIdentidad("Face ID")).resolves.toBe(false);
    await expect(mod.leerEleccion()).resolves.toBeNull();
    await expect(mod.guardarEleccion("activada")).resolves.toBeUndefined();
    await expect(mod.entrarConBiometria()).resolves.toBeNull();
  });
});
