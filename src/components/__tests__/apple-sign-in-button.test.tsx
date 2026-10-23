// @vitest-environment happy-dom
/**
 * El botón de Apple montado de verdad.
 *
 * Cuándo corresponde dibujarlo se prueba en `lib/__tests__/apple-nativo.test.ts`;
 * acá se simula el gate y se fija lo que hace el componente con él: que el
 * primer pintado sea vacío (es lo que ve el export estático y la web), que
 * fuera del bundle ni pregunte, y que el clic devuelva la sesión o el mensaje.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  bundled: true,
  appleNativoListo: vi.fn(),
  sesionConAppleNativo: vi.fn(),
}));
vi.mock("@/lib/mobile-env", () => ({
  get IS_BUNDLED() {
    return m.bundled;
  },
}));
vi.mock("@/lib/native/apple-sign-in", () => ({ appleNativoListo: m.appleNativoListo }));
vi.mock("@/lib/auth-apple", () => ({
  sesionConAppleNativo: m.sesionConAppleNativo,
  mensajeDeErrorDeApple: (e: unknown) => `traducido: ${(e as Error).message}`,
}));

import {
  AppleSignInButton,
  useAppleSignInDisponible,
} from "@/components/apple-sign-in-button";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenedor: HTMLDivElement;
let raiz: Root;

function Sonda() {
  return <span>{useAppleSignInDisponible() ? "si" : "no"}</span>;
}

async function montar(elemento: React.ReactElement) {
  await act(async () => {
    raiz.render(elemento);
  });
}

beforeEach(() => {
  m.bundled = true;
  m.appleNativoListo.mockReset();
  m.sesionConAppleNativo.mockReset();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
});

describe("useAppleSignInDisponible", () => {
  it("en el binario con entitlement pasa a true después de montar", async () => {
    m.appleNativoListo.mockResolvedValue(true);
    await montar(<Sonda />);
    expect(contenedor.textContent).toBe("si");
  });

  it("si el gate dice que no, se queda en false", async () => {
    m.appleNativoListo.mockResolvedValue(false);
    await montar(<Sonda />);
    expect(contenedor.textContent).toBe("no");
  });

  it("fuera del bundle ni le pregunta al gate", async () => {
    m.bundled = false;
    await montar(<Sonda />);
    expect(contenedor.textContent).toBe("no");
    expect(m.appleNativoListo).not.toHaveBeenCalled();
  });
});

describe("AppleSignInButton", () => {
  function boton() {
    return contenedor.querySelector("button") as HTMLButtonElement;
  }

  it("dice \"Continuar con Apple\" y entrega la sesión ya canjeada", async () => {
    const sesion = { username: "a", isNewUser: false };
    m.sesionConAppleNativo.mockResolvedValue(sesion);
    const onSession = vi.fn();
    await montar(<AppleSignInButton onSession={onSession} onError={vi.fn()} />);

    expect(boton().textContent).toBe("Continuar con Apple");
    await act(async () => boton().click());
    expect(onSession).toHaveBeenCalledWith(sesion);
    expect(boton().disabled).toBe(false);
  });

  it("un error llega traducido a onError", async () => {
    m.sesionConAppleNativo.mockRejectedValue(new Error("1000"));
    const onError = vi.fn();
    await montar(<AppleSignInButton onSession={vi.fn()} onError={onError} />);

    await act(async () => boton().click());
    expect(onError).toHaveBeenCalledWith("traducido: 1000");
  });

  it("deshabilitado mientras el formulario está en curso", async () => {
    await montar(<AppleSignInButton onSession={vi.fn()} onError={vi.fn()} disabled />);
    expect(boton().disabled).toBe(true);
  });
});
