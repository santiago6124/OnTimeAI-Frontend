// @vitest-environment happy-dom
/**
 * El gate del bundle montado: con sesión resuelta dibuja la app y, al lado, la
 * oferta de Face ID —que decide sola si aparece—. Sin sesión no la dibuja:
 * ofrecer Face ID a alguien que no entró no tiene sentido.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  token: null as string | null,
  ruta: "/login",
  apiMe: vi.fn(),
  biometriaParaOfrecer: vi.fn(),
  entrarConBiometria: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => m.ruta }));
vi.mock("@/lib/api", () => ({ apiMe: m.apiMe }));
vi.mock("@/lib/native/session", () => ({
  loadToken: async () => m.token,
  clearToken: async () => undefined,
}));
vi.mock("@/lib/native/biometria", () => ({
  entrarConBiometria: m.entrarConBiometria,
  biometriaParaOfrecer: m.biometriaParaOfrecer,
}));
vi.mock("@/lib/native/app-ready", () => ({
  notifyAppReady: async () => undefined,
  hideSplash: async () => undefined,
}));

import { NativeSessionGate } from "@/components/providers/native-session-provider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  m.token = null;
  m.ruta = "/login";
  m.apiMe.mockReset();
  m.entrarConBiometria.mockReset().mockResolvedValue(null);
  m.biometriaParaOfrecer.mockReset().mockResolvedValue("Face ID");
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(async () => {
  await act(async () => raiz.unmount());
  contenedor.remove();
});

async function montar() {
  await act(async () => {
    raiz.render(
      <NativeSessionGate>
        <main>la app</main>
      </NativeSessionGate>,
    );
  });
}

describe("NativeSessionGate y Face ID", () => {
  it("en /login sin sesión dibuja el login y no ofrece Face ID", async () => {
    await montar();
    expect(contenedor.textContent).toContain("la app");
    expect(contenedor.textContent).not.toContain("Usar Face ID");
    expect(m.entrarConBiometria).toHaveBeenCalledTimes(1);
  });

  it("con sesión dibuja la app y, al lado, la oferta", async () => {
    m.ruta = "/";
    m.token = "jwt";
    m.apiMe.mockResolvedValue({ username: "ana", role: "user", userType: "b2c" });

    await montar();

    expect(contenedor.textContent).toContain("la app");
    expect(contenedor.textContent).toContain("Usar Face ID para entrar");
    // Con un JWT vigente no se pide la cara.
    expect(m.entrarConBiometria).not.toHaveBeenCalled();
  });

  it("si Face ID devuelve sesión estando en /login, sale del login", async () => {
    // El 401 de un token vencido con la app abierta cae en /login: la cara
    // tiene que poder sacarlo de ahí.
    m.entrarConBiometria.mockResolvedValue({ username: "ana", role: "user", userType: "b2c" });
    const replace = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      replace,
    } as Location);

    await montar();

    expect(replace).toHaveBeenCalledWith("/");
    vi.restoreAllMocks();
  });
});
