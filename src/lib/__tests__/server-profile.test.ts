/**
 * CP-COB-FE-16 — `src/lib/server-profile.ts`: el perfil con el que el
 * servidor dibuja la página, con la misma precedencia que `ProfileProvider`
 * en el cliente: el override de la cookie manda sólo para admin/superadmin;
 * para el resto, el perfil de la cuenta; sin cuenta, pasajero.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/auth-types";

const estado = vi.hoisted(() => ({
  sesion: null as SessionUser | null,
  cookie: undefined as string | undefined,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "ontimeai-profile" && estado.cookie ? { value: estado.cookie } : undefined,
  }),
}));
vi.mock("@/lib/server-auth", () => ({
  getVerifiedSession: async () => estado.sesion,
}));

beforeEach(() => {
  estado.sesion = null;
  estado.cookie = undefined;
});

describe("getServerProfile", () => {
  it("un admin con override en la cookie ve ese perfil", async () => {
    // Arrange
    estado.sesion = { username: "a", role: "admin", userType: "b2c" };
    estado.cookie = "airline";
    const { getServerProfile } = await import("@/lib/server-profile");

    // Act / Assert
    await expect(getServerProfile()).resolves.toBe("airline");
  });

  it("un superadmin también puede elegir", async () => {
    estado.sesion = { username: "a", role: "superadmin", userType: "b2b" };
    estado.cookie = "passenger";
    const { getServerProfile } = await import("@/lib/server-profile");

    await expect(getServerProfile()).resolves.toBe("passenger");
  });

  it("un valor basura en la cookie se ignora y manda la cuenta", async () => {
    estado.sesion = { username: "a", role: "admin", userType: "b2b" };
    estado.cookie = "hacker";
    const { getServerProfile } = await import("@/lib/server-profile");

    await expect(getServerProfile()).resolves.toBe("airline");
  });

  it("un admin sin override ni tipo de cuenta es pasajero", async () => {
    estado.sesion = { username: "a", role: "admin", userType: null };
    const { getServerProfile } = await import("@/lib/server-profile");

    await expect(getServerProfile()).resolves.toBe("passenger");
  });

  it("un usuario común no puede pisar su perfil con la cookie", async () => {
    estado.sesion = { username: "a", role: "user", userType: "b2c" };
    estado.cookie = "airline";
    const { getServerProfile } = await import("@/lib/server-profile");

    await expect(getServerProfile()).resolves.toBe("passenger");
  });

  it("un usuario común de operaciones ve aerolínea", async () => {
    estado.sesion = { username: "a", role: "user", userType: "b2b" };
    const { getServerProfile } = await import("@/lib/server-profile");

    await expect(getServerProfile()).resolves.toBe("airline");
  });

  it("sin sesión es pasajero aunque haya cookie", async () => {
    estado.cookie = "airline";
    const { getServerProfile } = await import("@/lib/server-profile");

    await expect(getServerProfile()).resolves.toBe("passenger");
  });
});
