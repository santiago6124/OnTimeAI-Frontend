/**
 * CP-COB-FE-06 — `/api/backend/[...path]`: el BFF same-origin que traduce la
 * cookie HttpOnly en el `Authorization` que el FastAPI espera.
 *
 * Lo que garantiza: sin cookie no hay ida al backend (401 local); la ruta, la
 * query, el método, el cuerpo y el `Content-Type` llegan intactos; la
 * respuesta vuelve con el código y el tipo del backend y sin caché; un 401
 * del backend vence la cookie para cortar el ciclo de reintentos; y un
 * backend que no responde se informa como 504.
 *
 * Se usan `NextRequest` reales y un `fetch` falso.
 */
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME } from "@/lib/auth-types";

const BACKEND = "https://backend.test";
vi.stubEnv("BACKEND_API_URL", BACKEND);

type Llamada = { url: string; init: RequestInit };
const llamadas: Llamada[] = [];

function pedido(
  ruta: string,
  opciones: { method?: string; cookie?: string; headers?: Record<string, string>; body?: string } = {},
) {
  const headers = new Headers(opciones.headers);
  if (opciones.cookie) headers.set("cookie", `${AUTH_COOKIE_NAME}=${opciones.cookie}`);
  return new NextRequest(`http://localhost:3000/api/backend/${ruta}`, {
    method: opciones.method ?? "GET",
    headers,
    body: opciones.body,
  });
}

function contexto(...segmentos: string[]) {
  return { params: Promise.resolve({ path: segmentos }) };
}

/** El backend falso. Sin `contentType` no manda cabecera, como un 204 real. */
function upstream(status: number, body: string, contentType?: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      llamadas.push({ url: String(url), init });
      const respuesta = new Response(body === "" ? null : body, { status });
      if (contentType) respuesta.headers.set("content-type", contentType);
      else respuesta.headers.delete("content-type");
      return respuesta;
    }),
  );
}

async function handlers() {
  return import("@/app/api/backend/[...path]/route");
}

afterEach(() => {
  llamadas.length = 0;
  vi.unstubAllGlobals();
});

describe("/api/backend/[...path]", () => {
  it("sin cookie responde 401 sin tocar el backend", async () => {
    // Arrange
    upstream(200, "{}");
    const { GET } = await handlers();

    // Act
    const respuesta = await GET(pedido("flights"), contexto("flights"));

    // Assert
    expect(respuesta.status).toBe(401);
    await expect(respuesta.json()).resolves.toEqual({ detail: "Sesión requerida" });
    expect(llamadas).toHaveLength(0);
  });

  it("reenvía ruta, query y Accept con el Bearer de la cookie", async () => {
    upstream(200, '[{"id":1}]', "application/json; charset=utf-8");
    const { GET } = await handlers();

    const respuesta = await GET(
      pedido("flights/SYN%2F1?status=active&x=1", { cookie: "jwt-1", headers: { accept: "text/csv" } }),
      contexto("flights", "SYN/1"),
    );

    expect(llamadas[0].url).toBe(`${BACKEND}/flights/SYN%2F1?status=active&x=1`);
    expect(llamadas[0].init.method).toBe("GET");
    expect(llamadas[0].init.body).toBeUndefined();
    expect(llamadas[0].init.cache).toBe("no-store");
    const headers = llamadas[0].init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer jwt-1");
    expect(headers.get("accept")).toBe("text/csv");
    expect(headers.get("content-type")).toBeNull();

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
    await expect(respuesta.json()).resolves.toEqual([{ id: 1 }]);
  });

  it("sin Accept ni Content-Type del backend asume JSON", async () => {
    upstream(201, "{}");
    const { GET } = await handlers();

    const respuesta = await GET(pedido("x", { cookie: "jwt-1" }), contexto("x"));

    expect((llamadas[0].init.headers as Headers).get("accept")).toBe("application/json");
    expect(respuesta.status).toBe(201);
    expect(respuesta.headers.get("content-type")).toBe("application/json");
  });

  it("en POST pasa el cuerpo en bytes y el Content-Type tal cual", async () => {
    upstream(200, '{"ok":true}');
    const { POST } = await handlers();

    await POST(
      pedido("users/me/flights", {
        method: "POST",
        cookie: "jwt-1",
        headers: { "content-type": "application/json" },
        body: '{"fa_flight_id":"abc"}',
      }),
      contexto("users", "me", "flights"),
    );

    expect(llamadas[0].init.method).toBe("POST");
    expect((llamadas[0].init.headers as Headers).get("content-type")).toBe("application/json");
    expect(new TextDecoder().decode(llamadas[0].init.body as ArrayBuffer)).toBe('{"fa_flight_id":"abc"}');
  });

  it("en DELETE conserva el método", async () => {
    upstream(204, "");
    const { DELETE } = await handlers();

    const respuesta = await DELETE(pedido("users/me", { method: "DELETE", cookie: "jwt-1" }), contexto("users", "me"));

    expect(llamadas[0].init.method).toBe("DELETE");
    expect(respuesta.status).toBe(204);
  });

  it("un 401 del backend vence la cookie para no reintentar con un token muerto", async () => {
    upstream(401, '{"detail":"expired"}');
    const { GET } = await handlers();

    const respuesta = await GET(pedido("flights", { cookie: "jwt-vencido" }), contexto("flights"));

    expect(respuesta.status).toBe(401);
    expect(respuesta.cookies.get(AUTH_COOKIE_NAME)).toMatchObject({ value: "", maxAge: 0, httpOnly: true });
  });

  it("con el backend ok no toca la cookie", async () => {
    upstream(200, "{}");
    const { GET } = await handlers();

    const respuesta = await GET(pedido("flights", { cookie: "jwt-1" }), contexto("flights"));

    expect(respuesta.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("si el backend no responde devuelve 504", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    const { PATCH } = await handlers();

    const respuesta = await PATCH(pedido("users/me", { method: "PATCH", cookie: "jwt-1" }), contexto("users", "me"));

    expect(respuesta.status).toBe(504);
    await expect(respuesta.json()).resolves.toEqual({ detail: "El Backend no respondió a tiempo" });
  });

  it("los cinco verbos van al mismo proxy", async () => {
    const { GET, POST, PUT, PATCH, DELETE } = await handlers();
    expect(new Set([GET, POST, PUT, PATCH, DELETE]).size).toBe(1);
  });
});
