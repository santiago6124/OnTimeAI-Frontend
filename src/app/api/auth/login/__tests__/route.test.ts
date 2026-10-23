/**
 * CP-COB-FE-04 — `POST /api/auth/login`: el BFF que cambia usuario y
 * contraseña por la cookie HttpOnly.
 *
 * Lo que tiene que garantizar: que el token del backend termine en la cookie
 * y no en el cuerpo de la respuesta, que el rechazo del backend llegue con su
 * `detail`, que una sesión que /auth/me no sabe describir no se abra, y que
 * un backend caído se informe como 503 y no como 500 genérico.
 *
 * El backend es un `fetch` falso con las dos llamadas: login y /auth/me.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/login/route";
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from "@/lib/auth-types";

type Llamada = { url: string; init: RequestInit };
const llamadas: Llamada[] = [];

function pedido(body: unknown) {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function backend(opciones: {
  login: { status: number; body: unknown };
  me?: { status: number; body: unknown };
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      const href = String(url);
      llamadas.push({ url: href, init });
      if (href.endsWith("/auth/login")) {
        return new Response(JSON.stringify(opciones.login.body), { status: opciones.login.status });
      }
      const me = opciones.me ?? { status: 200, body: {} };
      return new Response(JSON.stringify(me.body), { status: me.status });
    }),
  );
}

afterEach(() => {
  llamadas.length = 0;
  vi.unstubAllGlobals();
});

describe("POST /api/auth/login", () => {
  it("rechaza un cuerpo que no es JSON sin tocar el backend", async () => {
    // Arrange
    backend({ login: { status: 200, body: {} } });

    // Act
    const respuesta = await POST(pedido("esto-no-es-json"));

    // Assert
    expect(respuesta.status).toBe(400);
    await expect(respuesta.json()).resolves.toEqual({ detail: "Solicitud inválida" });
    expect(llamadas).toHaveLength(0);
  });

  it("deja el JWT en una cookie HttpOnly y devuelve sólo usuario y rol", async () => {
    backend({
      login: { status: 200, body: { access_token: "jwt-propio", token_type: "bearer" } },
      me: { status: 200, body: { username: "ana", role: "admin", user_type: "b2b" } },
    });

    const respuesta = await POST(pedido({ username: "ana", password: "secreta" }));

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({ username: "ana", role: "admin" });
    const cookie = respuesta.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie).toMatchObject({
      value: "jwt-propio",
      httpOnly: true,
      sameSite: "lax",
      maxAge: AUTH_MAX_AGE_SECONDS,
      path: "/",
    });
  });

  it("reenvía las credenciales al backend y valida el token con /auth/me", async () => {
    backend({
      login: { status: 200, body: { access_token: "jwt-propio" } },
      me: { status: 200, body: { username: "ana", role: "user" } },
    });

    await POST(pedido({ username: "ana", password: "secreta" }));

    const [login, me] = llamadas;
    expect(login.url).toMatch(/\/auth\/login$/);
    expect(login.init.method).toBe("POST");
    expect(JSON.parse(String(login.init.body))).toEqual({ username: "ana", password: "secreta" });
    expect(me.url).toMatch(/\/auth\/me$/);
    expect((me.init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-propio");
  });

  it("propaga el detail y el código del backend cuando rechaza las credenciales", async () => {
    backend({ login: { status: 401, body: { detail: "Usuario o contraseña incorrectos" } } });

    const respuesta = await POST(pedido({ username: "ana", password: "mal" }));

    expect(respuesta.status).toBe(401);
    await expect(respuesta.json()).resolves.toEqual({ detail: "Usuario o contraseña incorrectos" });
    expect(respuesta.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("sin detail del backend usa 'Credenciales incorrectas'", async () => {
    backend({ login: { status: 403, body: {} } });

    const respuesta = await POST(pedido({ username: "ana", password: "mal" }));

    expect(respuesta.status).toBe(403);
    await expect(respuesta.json()).resolves.toEqual({ detail: "Credenciales incorrectas" });
  });

  it.each([
    ["/auth/me falla", { status: 500, body: { detail: "boom" } }],
    ["el rol es desconocido", { status: 200, body: { username: "ana", role: "mago" } }],
    ["falta el username", { status: 200, body: { role: "user" } }],
  ])("no abre sesión si %s: 502 y sin cookie", async (_caso, me) => {
    backend({ login: { status: 200, body: { access_token: "jwt-propio" } }, me });

    const respuesta = await POST(pedido({ username: "ana", password: "secreta" }));

    expect(respuesta.status).toBe(502);
    await expect(respuesta.json()).resolves.toEqual({ detail: "No se pudo validar la sesión" });
    expect(respuesta.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("responde 503 cuando el backend no contesta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );

    const respuesta = await POST(pedido({ username: "ana", password: "secreta" }));

    expect(respuesta.status).toBe(503);
    await expect(respuesta.json()).resolves.toEqual({
      detail: "El servicio de autenticación no está disponible",
    });
  });
});
