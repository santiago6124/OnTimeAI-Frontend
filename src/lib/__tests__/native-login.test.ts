/**
 * CP-COB-FE-02 — Rama del bundle nativo de `src/lib/api.ts` que
 * `native-auth.test.ts` no cubre: `apiLogin` con usuario y contraseña
 * (`nativeLogin`), la caída de red del intercambio, el 401 que borra el token
 * guardado y redirige, `apiLogout` y `apiDeleteAccount` sin BFF.
 *
 * Se simula `IS_BUNDLED` y el almacenamiento nativo del token; el backend es
 * un `fetch` falso que registra a dónde y con qué headers se llamó.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API = "https://backend.test";
const almacen: { token: string | null } = { token: null };

vi.mock("@/lib/mobile-env", () => ({
  IS_BUNDLED: true,
  API_ORIGIN: API,
  APP_ORIGIN: "https://app.test",
  REPORTS_ENABLED: false,
  // Como en el bundle real: las navegaciones duras llevan barra final.
  appPath: (p: string) => `${p}/`,
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

function sinRed() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("fetch failed");
    }),
  );
}

function header(llamada: Llamada, nombre: string) {
  return (llamada.init.headers as Record<string, string> | undefined)?.[nombre];
}

const replace = vi.fn();

beforeEach(() => {
  almacen.token = null;
  llamadas.length = 0;
  replace.mockReset();
  vi.stubGlobal("window", { location: { pathname: "/", replace } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiLogin en el bundle (nativeLogin)", () => {
  it("hace los dos saltos del BFF: login y /auth/me, y guarda el JWT", async () => {
    // Arrange: el FastAPI acepta las credenciales y describe al usuario.
    backend({
      "/auth/login": { status: 200, body: { access_token: "jwt-1", token_type: "bearer" } },
      "/auth/me": { status: 200, body: { username: "ana", role: "user", user_type: "b2c" } },
    });
    const { apiLogin } = await import("@/lib/api");

    // Act
    const sesion = await apiLogin("ana", "secreta");

    // Assert: sesión completa, token persistido, Bearer en el segundo salto.
    expect(sesion).toEqual({ username: "ana", role: "user", userType: "b2c" });
    expect(almacen.token).toBe("jwt-1");
    const [login, me] = llamadas;
    expect(login.url).toBe(`${API}/auth/login`);
    expect(login.init.method).toBe("POST");
    expect(JSON.parse(String(login.init.body))).toEqual({ username: "ana", password: "secreta" });
    expect(me.url).toBe(`${API}/auth/me`);
    expect(header(me, "Authorization")).toBe("Bearer jwt-1");
  });

  it("propaga el detail del backend y no guarda nada", async () => {
    backend({ "/auth/login": { status: 401, body: { detail: "Usuario bloqueado" } } });
    const { apiLogin, ApiError } = await import("@/lib/api");

    await expect(apiLogin("ana", "x")).rejects.toMatchObject({ status: 401, message: "Usuario bloqueado" });
    await expect(apiLogin("ana", "x")).rejects.toBeInstanceOf(ApiError);
    expect(almacen.token).toBeNull();
  });

  it("sin detail ni token cae en 'Credenciales incorrectas'", async () => {
    backend({ "/auth/login": { status: 200, body: { token_type: "bearer" } } });
    const { apiLogin } = await import("@/lib/api");

    await expect(apiLogin("ana", "x")).rejects.toMatchObject({ status: 200, message: "Credenciales incorrectas" });
  });

  it("sin red responde 503 con un mensaje legible", async () => {
    sinRed();
    const { apiLogin } = await import("@/lib/api");

    await expect(apiLogin("ana", "x")).rejects.toMatchObject({
      status: 503,
      message: "No se pudo conectar con el servidor.",
    });
  });

  it("borra el token si /auth/me no lo acepta", async () => {
    backend({
      "/auth/login": { status: 200, body: { access_token: "jwt-roto" } },
      "/auth/me": { status: 500, body: { detail: "boom" } },
    });
    const { apiLogin } = await import("@/lib/api");

    await expect(apiLogin("ana", "x")).rejects.toMatchObject({ status: 500 });
    expect(almacen.token).toBeNull();
  });
});

describe("nativeExchange sin red", () => {
  it("apiLoginFirebase responde 503 y no guarda nada", async () => {
    sinRed();
    const { apiLoginFirebase } = await import("@/lib/api");

    await expect(apiLoginFirebase("t")).rejects.toMatchObject({ status: 503 });
    expect(almacen.token).toBeNull();
  });
});

describe("get() en el bundle", () => {
  it("un 401 borra el token guardado y manda al login con barra final", async () => {
    almacen.token = "jwt-vencido";
    backend({ "/flights": { status: 401, body: {} } });
    const { api } = await import("@/lib/api");

    await expect(api.flights()).rejects.toMatchObject({ status: 401 });

    expect(almacen.token).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login/");
  });

  it("sin token guardado no manda Authorization", async () => {
    backend({ "/auth/me": { status: 200, body: { username: "a", role: "user" } } });
    const { apiMe } = await import("@/lib/api");

    await apiMe();

    expect(header(llamadas[0], "Authorization")).toBeUndefined();
  });
});

describe("apiLogout y apiDeleteAccount en el bundle", () => {
  it("apiLogout sólo limpia el token: no hay BFF al que avisar", async () => {
    almacen.token = "jwt-1";
    backend({});
    const { apiLogout } = await import("@/lib/api");

    await apiLogout();

    expect(almacen.token).toBeNull();
    expect(llamadas).toHaveLength(0);
  });

  it("apiDeleteAccount pega al FastAPI con el Bearer y después limpia el token", async () => {
    almacen.token = "jwt-1";
    backend({ "/users/me": { status: 200, body: { ok: true } } });
    const { apiDeleteAccount } = await import("@/lib/api");

    await apiDeleteAccount();

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe(`${API}/users/me`);
    expect(llamadas[0].init.method).toBe("DELETE");
    expect(header(llamadas[0], "Authorization")).toBe("Bearer jwt-1");
    expect(almacen.token).toBeNull();
  });
});
