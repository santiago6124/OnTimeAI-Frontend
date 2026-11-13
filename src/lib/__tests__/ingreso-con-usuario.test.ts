import { describe, expect, it, vi, type Mock } from "vitest";

import { ApiError, type apiLogin } from "@/lib/api";
import {
  esUsuarioDelBackend,
  ingresarConUsuario,
} from "@/lib/ingreso-con-usuario";

describe("esUsuarioDelBackend", () => {
  it.each([
    ["admin", true],
    ["  viewer  ", true],
    ["store.reviewer@ontimeai.app", false],
    ["  ", false],
    ["", false],
  ])("%j → %s", (valor, esperado) => {
    expect(esUsuarioDelBackend(valor)).toBe(esperado);
  });
});

function preparar(login: Mock<typeof apiLogin>) {
  return { onError: vi.fn(), navegar: vi.fn(), login };
}

describe("ingresarConUsuario", () => {
  it("abre la sesión con el usuario sin espacios y va al inicio", async () => {
    const t = preparar(vi.fn<typeof apiLogin>().mockResolvedValue({ username: "admin", role: "superadmin" }));
    await ingresarConUsuario(" admin ", "clave", null, t.onError, t);
    expect(t.login).toHaveBeenCalledWith("admin", "clave");
    expect(t.navegar).toHaveBeenCalledWith("/");
    expect(t.onError).not.toHaveBeenCalled();
  });

  it("vuelve a la ruta pedida", async () => {
    const t = preparar(vi.fn<typeof apiLogin>().mockResolvedValue({ username: "admin", role: "superadmin" }));
    await ingresarConUsuario("admin", "clave", "/admin", t.onError, t);
    expect(t.navegar).toHaveBeenCalledWith("/admin");
  });

  it("no sigue una ruta de retorno externa", async () => {
    const t = preparar(vi.fn<typeof apiLogin>().mockResolvedValue({ username: "admin", role: "superadmin" }));
    await ingresarConUsuario("admin", "clave", "https://evil.example", t.onError, t);
    expect(t.navegar).toHaveBeenCalledWith("/");
  });

  it.each([
    [new ApiError(401, "Credenciales incorrectas"), "Usuario o contraseña incorrectos."],
    [
      new ApiError(503, "El servicio de autenticación no está disponible"),
      "El servicio de autenticación no está disponible",
    ],
    [new TypeError("Failed to fetch"), "No se pudo iniciar sesión. Probá de nuevo."],
  ])("si falla (%s) muestra el mensaje y no navega", async (cause, mensaje) => {
    const t = preparar(vi.fn<typeof apiLogin>().mockRejectedValue(cause));
    await ingresarConUsuario("admin", "mala", null, t.onError, t);
    expect(t.onError).toHaveBeenCalledWith(mensaje);
    expect(t.navegar).not.toHaveBeenCalled();
  });
});
