// @vitest-environment happy-dom
/**
 * Las superficies de Face ID montadas de verdad, con efectos y clics.
 *
 * `biometria.test.ts` fija el primer pintado (vacío) con `react-dom/server`;
 * acá se monta con un DOM para ver lo que pasa después: que aparezcan solo si
 * `lib/native/biometria` dice que corresponde y que cada botón haga lo que
 * promete. La lógica de cuándo corresponde se prueba en
 * `lib/__tests__/biometria.test.ts`; acá se simula.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  biometriaParaOfrecer: vi.fn(),
  estadoDelAjuste: vi.fn(),
  activarBiometria: vi.fn(),
  desactivarBiometria: vi.fn(),
}));
vi.mock("@/lib/native/biometria", () => m);

import { AjusteBiometria, OfertaBiometria } from "@/components/biometria";

// React exige esta marca para que `act` no avise en un entorno que no es Jest.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenedor: HTMLDivElement;
let raiz: Root;

async function montar(elemento: React.ReactElement) {
  await act(async () => {
    raiz.render(elemento);
  });
}

function boton(texto: string): HTMLButtonElement {
  const b = [...contenedor.querySelectorAll("button")].find(
    (x) => x.textContent === texto,
  );
  if (!b) throw new Error(`no hay botón "${texto}" en: ${contenedor.textContent}`);
  return b;
}

async function tocar(texto: string) {
  await act(async () => {
    boton(texto).click();
  });
}

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.activarBiometria.mockResolvedValue(true);
  m.desactivarBiometria.mockResolvedValue(undefined);
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(async () => {
  await act(async () => raiz.unmount());
  contenedor.remove();
});

describe("OfertaBiometria", () => {
  it("si no corresponde, no dibuja nada", async () => {
    m.biometriaParaOfrecer.mockResolvedValue(null);
    await montar(<OfertaBiometria />);
    expect(contenedor.innerHTML).toBe("");
  });

  it("si la consulta falla, tampoco: no hay un error propio que mostrar", async () => {
    m.biometriaParaOfrecer.mockRejectedValue(new Error("sin puente"));
    await montar(<OfertaBiometria />);
    expect(contenedor.innerHTML).toBe("");
  });

  it("aceptar activa con el nombre del teléfono y la tarjeta se va", async () => {
    m.biometriaParaOfrecer.mockResolvedValue("Face ID");
    await montar(<OfertaBiometria />);
    expect(contenedor.textContent).toContain("Usar Face ID para entrar");

    await tocar("Usar Face ID");

    expect(m.activarBiometria).toHaveBeenCalledWith("Face ID");
    expect(m.desactivarBiometria).not.toHaveBeenCalled();
    expect(contenedor.innerHTML).toBe("");
  });

  it("'Ahora no' guarda el rechazo y la tarjeta se va", async () => {
    m.biometriaParaOfrecer.mockResolvedValue("Face ID");
    await montar(<OfertaBiometria />);

    await tocar("Ahora no");

    expect(m.desactivarBiometria).toHaveBeenCalledTimes(1);
    expect(m.activarBiometria).not.toHaveBeenCalled();
    expect(contenedor.innerHTML).toBe("");
  });
});

describe("AjusteBiometria", () => {
  it("si no corresponde (web, Android), no dibuja nada", async () => {
    m.estadoDelAjuste.mockResolvedValue(null);
    await montar(<AjusteBiometria />);
    expect(contenedor.innerHTML).toBe("");
  });

  it("activar pide la cara y, si pasa, queda activado", async () => {
    m.estadoDelAjuste.mockResolvedValue({ tipo: "Face ID", activada: false });
    await montar(<AjusteBiometria />);

    await tocar("Activar Face ID");

    expect(m.activarBiometria).toHaveBeenCalledWith("Face ID");
    expect(boton("Desactivar Face ID").getAttribute("aria-checked")).toBe("true");
  });

  it("si la cara no pasa al activar, sigue desactivado", async () => {
    m.estadoDelAjuste.mockResolvedValue({ tipo: "Face ID", activada: false });
    m.activarBiometria.mockResolvedValue(false);
    await montar(<AjusteBiometria />);

    await tocar("Activar Face ID");

    expect(boton("Activar Face ID").getAttribute("aria-checked")).toBe("false");
  });

  it("desactivar no pide la cara", async () => {
    m.estadoDelAjuste.mockResolvedValue({ tipo: "Face ID", activada: true });
    await montar(<AjusteBiometria />);

    await tocar("Desactivar Face ID");

    expect(m.desactivarBiometria).toHaveBeenCalledTimes(1);
    expect(m.activarBiometria).not.toHaveBeenCalled();
    expect(boton("Activar Face ID")).toBeTruthy();
  });
});
