/**
 * CP-COB-FE-15 — `src/lib/server-auth.ts`: la sesión verificada del lado del
 * servidor. El backend sigue siendo la autoridad: una cookie sola no alcanza,
 * y cualquier cosa que el backend no confirme es "sin sesión", nunca un error
 * que tire la página.
 *
 * `server-only` y `next/headers` se simulan; el backend es un `fetch` falso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "auth-token" && estado.token ? { value: estado.token } : undefined,
  }),
}));

type Llamada = { url: string; init: RequestInit };
const llamadas: Llamada[] = [];

function backend(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      llamadas.push({ url: String(url), init });
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

beforeEach(() => {
  estado.token = null;
  llamadas.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getServerToken", () => {
  it("devuelve el valor de la cookie, o null si no hay", async () => {
    const { getServerToken } = await import("@/lib/server-auth");

    await expect(getServerToken()).resolves.toBeNull();
    estado.token = "jwt-1";
    await expect(getServerToken()).resolves.toBe("jwt-1");
  });
});

describe("getVerifiedSession", () => {
  it("sin cookie no va al backend", async () => {
    // Arrange
    backend(200, { username: "ana", role: "user" });
    const { getVerifiedSession } = await import("@/lib/server-auth");

    // Act / Assert
    await expect(getVerifiedSession()).resolves.toBeNull();
    expect(llamadas).toHaveLength(0);
  });

  it("valida el token con /auth/me y devuelve la sesión con su tipo", async () => {
    estado.token = "jwt-1";
    backend(200, { username: "ana", role: "admin", user_type: "b2b" });
    const { getVerifiedSession } = await import("@/lib/server-auth");

    await expect(getVerifiedSession()).resolves.toEqual({ username: "ana", role: "admin", userType: "b2b" });

    expect(llamadas[0].url).toMatch(/\/auth\/me$/);
    expect((llamadas[0].init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-1");
    expect(llamadas[0].init.cache).toBe("no-store");
  });

  it("un user_type desconocido se lee como null", async () => {
    estado.token = "jwt-1";
    backend(200, { username: "ana", role: "user", user_type: "b2x" });
    const { getVerifiedSession } = await import("@/lib/server-auth");

    await expect(getVerifiedSession()).resolves.toMatchObject({ userType: null });
  });

  it.each([
    ["el backend rechaza el token", 401, { detail: "expired" }],
    ["el rol es desconocido", 200, { username: "ana", role: "mago" }],
    ["falta el username", 200, { role: "user" }],
  ])("si %s, no hay sesión", async (_caso, status, body) => {
    estado.token = "jwt-1";
    backend(status, body);
    const { getVerifiedSession } = await import("@/lib/server-auth");

    await expect(getVerifiedSession()).resolves.toBeNull();
  });

  it("si el backend no responde, no hay sesión y no se lanza", async () => {
    estado.token = "jwt-1";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    const { getVerifiedSession } = await import("@/lib/server-auth");

    await expect(getVerifiedSession()).resolves.toBeNull();
  });
});

describe("getServerRole", () => {
  it("sin sesión es 'user', el rol de menos privilegios", async () => {
    const { getServerRole } = await import("@/lib/server-auth");
    await expect(getServerRole()).resolves.toBe("user");
  });

  it("con sesión devuelve el rol que confirmó el backend", async () => {
    estado.token = "jwt-1";
    backend(200, { username: "root", role: "superadmin" });
    const { getServerRole } = await import("@/lib/server-auth");

    await expect(getServerRole()).resolves.toBe("superadmin");
  });
});
