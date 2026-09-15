/**
 * El alta propia pasa por el BFF, igual que el login y el de Google.
 *
 * Lo que se protege acá es que el token no llegue nunca al navegador —viaja en
 * una cookie HttpOnly— y que el motivo del rechazo del backend llegue tal cual
 * a quien está en el formulario: "ya existe una cuenta con ese correo" y "la
 * contraseña es corta" exigen acciones distintas, y un mensaje genérico deja a
 * la persona adivinando.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/register/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth-types";

const TOKEN = "header.payload.signature";

function request(body: unknown) {
  return new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function stubBackend(options: {
  register: { status: number; body: unknown };
  me?: { status: number; body: unknown };
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith("/auth/register")) {
        return new Response(JSON.stringify(options.register.body), {
          status: options.register.status,
        });
      }
      const me = options.me ?? {
        status: 200,
        body: { username: "alguien@ejemplo.com", role: "user" },
      };
      return new Response(JSON.stringify(me.body), { status: me.status });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/auth/register", () => {
  it("crea la cuenta y deja el token en una cookie HttpOnly", async () => {
    stubBackend({ register: { status: 201, body: { access_token: TOKEN } } });

    const res = await POST(
      request({ email: "alguien@ejemplo.com", password: "contrasena-larga" }),
    );

    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${AUTH_COOKIE_NAME}=${TOKEN}`);
    expect(cookie.toLowerCase()).toContain("httponly");

    const cuerpo = await res.json();
    expect(cuerpo.isNewUser).toBe(true);
    expect(cuerpo.userType).toBeNull();
    expect(cuerpo).not.toHaveProperty("access_token");
  });

  it("reenvía el motivo cuando el correo ya existe", async () => {
    stubBackend({
      register: {
        status: 409,
        body: { detail: "Ya existe una cuenta con ese correo" },
      },
    });

    const res = await POST(
      request({ email: "repetido@ejemplo.com", password: "contrasena-larga" }),
    );

    expect(res.status).toBe(409);
    expect((await res.json()).detail).toContain("Ya existe");
  });

  it("reenvía el motivo cuando la contraseña es corta", async () => {
    stubBackend({
      register: {
        status: 400,
        body: { detail: "La contraseña necesita al menos 10 caracteres" },
      },
    });

    const res = await POST(request({ email: "a@b.com", password: "corta" }));

    expect(res.status).toBe(400);
    expect((await res.json()).detail).toContain("10 caracteres");
  });

  it("rechaza un cuerpo sin correo o sin contraseña", async () => {
    const res = await POST(request({ email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("rechaza un cuerpo que no es JSON", async () => {
    const res = await POST(request("no-es-json"));
    expect(res.status).toBe(400);
  });

  it("devuelve 502 si el backend crea la cuenta pero /auth/me falla", async () => {
    // La cuenta quedó creada del otro lado; sin una sesión válida no se puede
    // seguir, y decir 200 dejaría al usuario en un estado que no existe.
    stubBackend({
      register: { status: 201, body: { access_token: TOKEN } },
      me: { status: 500, body: {} },
    });

    const res = await POST(
      request({ email: "a@b.com", password: "contrasena-larga" }),
    );
    expect(res.status).toBe(502);
  });

  it("devuelve 503 si el backend no responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sin conexión");
      }),
    );

    const res = await POST(
      request({ email: "a@b.com", password: "contrasena-larga" }),
    );
    expect(res.status).toBe(503);
  });
});
