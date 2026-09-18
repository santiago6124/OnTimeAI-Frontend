import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El bundle nativo no tiene BFF: estas pruebas fijan lo que api.ts hace en su
 * lugar. Se simula `IS_BUNDLED` y el almacenamiento nativo del token; el
 * backend es un `fetch` falso que registra a dónde y con qué headers se llamó.
 */

const API = "https://backend.test";
const almacen: { token: string | null } = { token: null };

vi.mock("@/lib/mobile-env", () => ({
  IS_BUNDLED: true,
  API_ORIGIN: API,
  APP_ORIGIN: "https://app.test",
  LIVE_ENABLED: false,
  REPORTS_ENABLED: false,
  appPath: (p: string) => p,
}));

vi.mock("@/lib/native/session", () => ({
  loadToken: async () => almacen.token,
  saveToken: async (t: string) => {
    almacen.token = t;
  },
  clearToken: async () => {
    almacen.token = null;
  },
}));

type Llamada = { url: string; init: RequestInit };
const llamadas: Llamada[] = [];

function backend(rutas: Record<string, { status: number; body: unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      const href = String(url);
      llamadas.push({ url: href, init });
      const ruta = Object.keys(rutas).find((r) => href.endsWith(r));
      if (!ruta) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify(rutas[ruta].body), { status: rutas[ruta].status });
    }),
  );
}

function header(llamada: Llamada, nombre: string) {
  return (llamada.init.headers as Record<string, string> | undefined)?.[nombre];
}

beforeEach(() => {
  almacen.token = null;
  llamadas.length = 0;
  // getAuthHeaders() distingue navegador de servidor por `window`.
  vi.stubGlobal("window", { location: { pathname: "/login", replace: vi.fn() } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiLoginFirebase en el bundle", () => {
  it("cambia el ID token contra el FastAPI, guarda el JWT y devuelve la sesión", async () => {
    backend({
      "/auth/firebase": {
        status: 200,
        body: { access_token: "jwt-1", token_type: "bearer", user_type: "b2b", is_new_user: false },
      },
      "/auth/me": { status: 200, body: { username: "ana", role: "user", user_type: "b2b" } },
    });
    const { apiLoginFirebase } = await import("@/lib/api");

    const session = await apiLoginFirebase("id-token-firebase");

    expect(session).toEqual({ username: "ana", role: "user", userType: "b2b", isNewUser: false });
    expect(almacen.token).toBe("jwt-1");

    const [exchange, me] = llamadas;
    expect(exchange.url).toBe(`${API}/auth/firebase`);
    expect(exchange.init.method).toBe("POST");
    expect(JSON.parse(String(exchange.init.body))).toEqual({ id_token: "id-token-firebase" });
    expect(me.url).toBe(`${API}/auth/me`);
    expect(header(me, "Authorization")).toBe("Bearer jwt-1");
  });

  it("marca isNewUser cuando la cuenta todavía no eligió tipo", async () => {
    backend({
      "/auth/firebase": {
        status: 200,
        body: { access_token: "jwt-2", user_type: null, is_new_user: true },
      },
      "/auth/me": { status: 200, body: { username: "nuevo", role: "user", user_type: null } },
    });
    const { apiLoginFirebase } = await import("@/lib/api");

    const session = await apiLoginFirebase("t");
    expect(session.isNewUser).toBe(true);
    expect(session.userType).toBeNull();
  });

  it("propaga el detail del backend y no guarda nada si el intercambio falla", async () => {
    backend({
      "/auth/firebase": { status: 401, body: { detail: "Correo sin verificar" } },
    });
    const { apiLoginFirebase, ApiError } = await import("@/lib/api");

    await expect(apiLoginFirebase("t")).rejects.toMatchObject({ status: 401, message: "Correo sin verificar" });
    await expect(apiLoginFirebase("t")).rejects.toBeInstanceOf(ApiError);
    expect(almacen.token).toBeNull();
  });

  it("borra el token si /auth/me no lo acepta", async () => {
    backend({
      "/auth/firebase": { status: 200, body: { access_token: "jwt-roto", is_new_user: false } },
      "/auth/me": { status: 502, body: { detail: "no" } },
    });
    const { apiLoginFirebase } = await import("@/lib/api");

    await expect(apiLoginFirebase("t")).rejects.toThrow();
    expect(almacen.token).toBeNull();
  });

  it("apiLoginGoogle usa la misma rama contra /auth/google", async () => {
    backend({
      "/auth/google": { status: 200, body: { access_token: "jwt-g", user_type: "b2c", is_new_user: false } },
      "/auth/me": { status: 200, body: { username: "g", role: "user", user_type: "b2c" } },
    });
    const { apiLoginGoogle } = await import("@/lib/api");

    const session = await apiLoginGoogle("google-id-token");
    expect(session.userType).toBe("b2c");
    expect(llamadas[0].url).toBe(`${API}/auth/google`);
  });
});

describe("después del login, en el bundle", () => {
  it("apiMe conserva userType", async () => {
    almacen.token = "jwt-1";
    backend({ "/auth/me": { status: 200, body: { username: "ana", role: "admin", user_type: "b2b" } } });
    const { apiMe } = await import("@/lib/api");

    await expect(apiMe()).resolves.toEqual({ username: "ana", role: "admin", userType: "b2b" });
  });

  it("apiSetUserType manda el Authorization al FastAPI directo", async () => {
    almacen.token = "jwt-1";
    backend({ "/users/me": { status: 200, body: { ok: true, user_type: "b2c" } } });
    const { apiSetUserType } = await import("@/lib/api");

    await apiSetUserType("b2c");

    expect(llamadas[0].url).toBe(`${API}/users/me`);
    expect(llamadas[0].init.method).toBe("PATCH");
    expect(header(llamadas[0], "Authorization")).toBe("Bearer jwt-1");
    expect(JSON.parse(String(llamadas[0].init.body))).toEqual({ user_type: "b2c" });
  });

  it("homePathFor no manda a un viajero a /live, que el bundle no trae", async () => {
    const { homePathFor } = await import("@/lib/auth-types");
    expect(homePathFor("b2c")).toBe("/");
    expect(homePathFor("b2b")).toBe("/");
  });
});
