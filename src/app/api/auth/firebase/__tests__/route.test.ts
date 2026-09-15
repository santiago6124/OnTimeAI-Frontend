/**
 * El canje del token de Firebase por la sesión propia.
 *
 * Lo que este handler tiene que garantizar y no se ve leyéndolo: que el 403 de
 * "falta verificar el correo" llegue entero al navegador —es el único rechazo
 * sobre el que la persona puede hacer algo— y que el token de Firebase no
 * termine en la cookie, porque prueba quién es una vez y no lleva nuestro rol.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/firebase/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth-types";

const TOKEN = "encabezado.cuerpo.firma";

function pedido(body: unknown) {
  return new Request("http://localhost:3000/api/auth/firebase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Simula las dos llamadas al backend: el canje y después /auth/me. */
function backend(opciones: {
  canje: { status: number; body: unknown };
  me?: { status: number; body: unknown };
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      if (String(url).endsWith("/auth/firebase")) {
        return new Response(JSON.stringify(opciones.canje.body), {
          status: opciones.canje.status,
        });
      }
      const me = opciones.me ?? { status: 200, body: {} };
      return new Response(JSON.stringify(me.body), { status: me.status });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/auth/firebase", () => {
  it("rechaza un cuerpo que no es JSON", async () => {
    expect((await POST(pedido("esto-no-es-json"))).status).toBe(400);
  });

  it.each([{}, { id_token: "" }, { id_token: 42 }])(
    "rechaza un id_token ausente o del tipo equivocado (%j)",
    async (body) => {
      expect((await POST(pedido(body))).status).toBe(400);
    },
  );

  it("deja pasar el 403 de correo sin verificar tal cual viene", async () => {
    backend({
      canje: {
        status: 403,
        body: { detail: "Falta verificar el correo. Revisá tu casilla y volvé a intentar." },
      },
    });

    const respuesta = await POST(pedido({ id_token: TOKEN }));
    // No es un 401 genérico: quien lo recibe puede ir a su casilla y resolverlo.
    expect(respuesta.status).toBe(403);
    await expect(respuesta.json()).resolves.toMatchObject({
      detail: "Falta verificar el correo. Revisá tu casilla y volvé a intentar.",
    });
  });

  it("deja nuestro JWT en la cookie, no el token de Firebase", async () => {
    backend({
      canje: {
        status: 200,
        body: { access_token: "jwt-propio", user_type: "b2c", is_new_user: false },
      },
      me: { status: 200, body: { username: "a@b.com", role: "user" } },
    });

    const respuesta = await POST(pedido({ id_token: TOKEN }));
    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({
      username: "a@b.com",
      role: "user",
      userType: "b2c",
      isNewUser: false,
    });

    const cookie = respuesta.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie?.value).toBe("jwt-propio");
    expect(cookie?.value).not.toBe(TOKEN);
    expect(cookie?.httpOnly).toBe(true);
  });

  it("manda al onboarding a una cuenta recién creada", async () => {
    backend({
      canje: {
        status: 200,
        body: { access_token: "jwt-propio", user_type: null, is_new_user: true },
      },
      me: { status: 200, body: { username: "a@b.com", role: "user" } },
    });

    await expect(
      (await POST(pedido({ id_token: TOKEN }))).json(),
    ).resolves.toMatchObject({ userType: null, isNewUser: true });
  });

  it("manda al onboarding a quien vuelve sin haber elegido tipo de cuenta", async () => {
    backend({
      canje: {
        status: 200,
        body: { access_token: "jwt-propio", user_type: null, is_new_user: false },
      },
      me: { status: 200, body: { username: "a@b.com", role: "user" } },
    });

    await expect(
      (await POST(pedido({ id_token: TOKEN }))).json(),
    ).resolves.toMatchObject({ isNewUser: true });
  });

  it("no abre una sesión que el backend no sabe describir", async () => {
    backend({
      canje: { status: 200, body: { access_token: "jwt-propio" } },
      me: { status: 200, body: { username: "a@b.com", role: "mago" } },
    });

    const respuesta = await POST(pedido({ id_token: TOKEN }));
    expect(respuesta.status).toBe(502);
    expect(respuesta.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("responde 503 cuando el backend no contesta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );

    expect((await POST(pedido({ id_token: TOKEN }))).status).toBe(503);
  });
});
