/**
 * Que entrar con Google sea UN camino, no dos.
 *
 * Durante un mes hubo dos sistemas en paralelo: el botón de la web cambiaba el
 * token contra `/auth/google` y el del teléfono contra `/auth/firebase`. Las
 * dos puertas guardaban por email, así que no partían cuentas, pero Firebase
 * no era el padrón completo: cuatro de los cinco usuarios con
 * `provider='google'` en producción no tenían cuenta de Firebase, y uno de
 * ellos se había dado de alta un mes después de que Firebase estuviera en uso.
 *
 * Esa deriva no se nota desde la app —el login funciona igual por los dos
 * lados— así que lo único que puede impedir que vuelva es una prueba.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Sesion = {
  username: string;
  role: string;
  userType: string;
  isNewUser: boolean;
};

const apiLoginFirebase = vi.fn<(idToken: string) => Promise<Sesion>>(async () => ({
  username: "quien@ejemplo.com",
  role: "user",
  userType: "b2c",
  isNewUser: false,
}));

const signInWithCredential = vi.fn<
  (auth: unknown, cred: unknown) => Promise<{ user: { getIdToken: () => Promise<string> } }>
>(async () => ({
  user: { getIdToken: async () => "id-token-de-firebase" },
}));

const credential = vi.fn((idToken: string) => ({ proveedor: "google", idToken }));

const pedirIdTokenDeGoogle = vi.fn(async () => "id-token-del-plugin");

vi.mock("@/lib/api", () => ({
  apiLoginFirebase: (t: string) => apiLoginFirebase(t),
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: { credential: (t: string) => credential(t) },
  signInWithCredential: (auth: unknown, cred: unknown) =>
    signInWithCredential(auth, cred),
}));

vi.mock("@/lib/firebase", () => ({ firebaseAuth: () => ({ marca: "auth" }) }));

vi.mock("@/lib/native/google-sign-in", () => ({
  pedirIdTokenDeGoogle: () => pedirIdTokenDeGoogle(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("entrar con Google", () => {
  it("desde la web: el token de Google Identity Services entra por Firebase", async () => {
    const { sesionConCredencialDeGoogle } = await import("@/lib/auth-google");

    const sesion = await sesionConCredencialDeGoogle("id-token-de-gis");

    // Lo que se está protegiendo: que NO vuelva a cambiarse contra
    // /auth/google, que es lo que dejaba a esta gente fuera de Firebase.
    expect(credential).toHaveBeenCalledWith("id-token-de-gis");
    expect(signInWithCredential).toHaveBeenCalledOnce();
    expect(apiLoginFirebase).toHaveBeenCalledWith("id-token-de-firebase");
    expect(sesion.username).toBe("quien@ejemplo.com");
  });

  it("desde el teléfono: el token del plugin entra por el mismo lugar", async () => {
    const { sesionConGoogleNativo } = await import("@/lib/auth-google");

    await sesionConGoogleNativo();

    expect(pedirIdTokenDeGoogle).toHaveBeenCalledOnce();
    expect(credential).toHaveBeenCalledWith("id-token-del-plugin");
    expect(apiLoginFirebase).toHaveBeenCalledWith("id-token-de-firebase");
  });

  it("los dos llegan al MISMO intercambio", async () => {
    // La prueba de la unificación propiamente dicha: da igual de dónde venga
    // el token, el backend recibe siempre un ID token de Firebase.
    const mod = await import("@/lib/auth-google");

    await mod.sesionConCredencialDeGoogle("desde-la-web");
    await mod.sesionConGoogleNativo();

    expect(apiLoginFirebase).toHaveBeenCalledTimes(2);
    const destinos = new Set(apiLoginFirebase.mock.calls.map(([t]) => t));
    expect(destinos).toEqual(new Set(["id-token-de-firebase"]));
  });

  it("si Firebase rechaza la credencial, el error sube sin convertirse en sesión", async () => {
    // Importa porque el modo de falla silenciosa sería devolver una sesión a
    // medias: el usuario entraría sin que Firebase lo conozca, que es
    // exactamente el estado del que venimos.
    signInWithCredential.mockRejectedValueOnce(
      Object.assign(new Error("auth/invalid-credential"), {
        code: "auth/invalid-credential",
      }),
    );
    const { sesionConCredencialDeGoogle } = await import("@/lib/auth-google");

    await expect(sesionConCredencialDeGoogle("token")).rejects.toThrow(
      /invalid-credential/,
    );
    expect(apiLoginFirebase).not.toHaveBeenCalled();
  });
});

describe("el camino viejo quedó desconectado", () => {
  it("api.ts ya no exporta apiLoginGoogle", async () => {
    const api = await vi.importActual<Record<string, unknown>>("@/lib/api");
    expect(api).not.toHaveProperty("apiLoginGoogle");
  });
});
