/**
 * Con qué sesión arranca el bundle: el JWT guardado primero, Face ID después,
 * y el login si no queda nada.
 *
 * Lo que importa fijar es el orden. Si Face ID se probara antes que el JWT, la
 * app pediría la cara en cada arranque aunque la sesión siga vigente; si no se
 * probara después de un JWT rechazado, la función no serviría para lo único
 * que hace: el token de 8 h que venció.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  token: null as string | null,
  apiMe: vi.fn(),
  clearToken: vi.fn(),
  entrarConBiometria: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/api", () => ({ apiMe: m.apiMe }));
vi.mock("@/lib/native/session", () => ({
  loadToken: async () => m.token,
  clearToken: m.clearToken,
}));
vi.mock("@/lib/native/biometria", () => ({
  entrarConBiometria: m.entrarConBiometria,
}));

const ANA = { username: "ana", role: "user", userType: "b2c" };

beforeEach(() => {
  m.token = null;
  m.apiMe.mockReset();
  m.clearToken.mockReset();
  m.entrarConBiometria.mockReset().mockResolvedValue(null);
});

describe("resolverSesion", () => {
  it("con un JWT vigente entra sin pedir la cara", async () => {
    m.token = "jwt";
    m.apiMe.mockResolvedValue(ANA);
    const { resolverSesion } = await import("@/components/providers/native-session-provider");

    await expect(resolverSesion()).resolves.toEqual(ANA);
    expect(m.entrarConBiometria).not.toHaveBeenCalled();
  });

  it("con el JWT vencido lo borra y prueba con Face ID", async () => {
    m.token = "jwt-viejo";
    m.apiMe.mockRejectedValue(new Error("401"));
    m.entrarConBiometria.mockResolvedValue(ANA);
    const { resolverSesion } = await import("@/components/providers/native-session-provider");

    await expect(resolverSesion()).resolves.toEqual(ANA);
    expect(m.clearToken).toHaveBeenCalledTimes(1);
    expect(m.entrarConBiometria).toHaveBeenCalledTimes(1);
  });

  it("sin JWT y sin Face ID, al login", async () => {
    const { resolverSesion } = await import("@/components/providers/native-session-provider");

    await expect(resolverSesion()).resolves.toBeNull();
    expect(m.apiMe).not.toHaveBeenCalled();
    expect(m.entrarConBiometria).toHaveBeenCalledTimes(1);
  });
});
