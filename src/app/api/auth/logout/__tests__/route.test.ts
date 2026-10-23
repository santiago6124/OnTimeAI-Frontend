/**
 * CP-COB-FE-05 — `POST /api/auth/logout`: cerrar la sesión es vaciar la
 * cookie HttpOnly, que el JS del navegador no puede tocar por su cuenta.
 */
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/logout/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth-types";

describe("POST /api/auth/logout", () => {
  it("responde ok y vence la cookie de sesión", async () => {
    // Arrange
    const pedido = new Request("http://localhost:3000/api/auth/logout", { method: "POST" });

    // Act
    const respuesta = await POST(pedido);

    // Assert: la cookie se pisa vacía y con maxAge 0, con los mismos
    // atributos con los que se puso para que el navegador la reemplace.
    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({ ok: true });
    expect(respuesta.cookies.get(AUTH_COOKIE_NAME)).toMatchObject({
      value: "",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });
});
