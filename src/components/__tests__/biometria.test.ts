/**
 * Las superficies de Face ID: lo que se ve, y sobre todo lo que NO se ve.
 *
 * Se renderiza con `react-dom/server`, donde los efectos no corren. Para los
 * contenedores eso es exactamente el primer pintado en cualquier plataforma,
 * antes de que nadie le pregunte al teléfono: tiene que ser vacío. Si
 * dibujaran algo de entrada, Android —que carga esta web desde Cloud Run— lo
 * mostraría aunque nunca vaya a tener Face ID.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AjusteBiometria,
  AjusteBiometriaVista,
  OfertaBiometria,
  OfertaBiometriaVista,
} from "@/components/biometria";

const nada = () => undefined;

/** Sin los marcadores `<!-- -->` que React mete entre texto e interpolación. */
const texto = (html: string) => html.replace(/<!-- -->/g, "");

describe("contenedores", () => {
  it("la oferta no dibuja nada hasta confirmar que corresponde", () => {
    expect(renderToString(createElement(OfertaBiometria))).toBe("");
  });

  it("el ajuste no dibuja nada hasta confirmar que corresponde", () => {
    expect(renderToString(createElement(AjusteBiometria))).toBe("");
  });
});

describe("OfertaBiometriaVista", () => {
  it("nombra la biometría del teléfono y ofrece las dos salidas", () => {
    const html = renderToString(
      createElement(OfertaBiometriaVista, {
        tipo: "Touch ID",
        ocupado: false,
        onAceptar: nada,
        onRechazar: nada,
      }),
    );
    expect(texto(html)).toContain("Usar Touch ID para entrar");
    expect(html).toContain("Ahora no");
    expect(html).not.toContain("Face ID");
  });

  it("mientras se verifica, los botones no responden", () => {
    const html = renderToString(
      createElement(OfertaBiometriaVista, {
        tipo: "Face ID",
        ocupado: true,
        onAceptar: nada,
        onRechazar: nada,
      }),
    );
    expect(html.match(/<button[^>]*\sdisabled=""/g)).toHaveLength(2);
  });
});

describe("AjusteBiometriaVista", () => {
  it.each([
    [true, "Desactivar Face ID", 'aria-checked="true"'],
    [false, "Activar Face ID", 'aria-checked="false"'],
  ])("activada=%s muestra la acción contraria", (activada, accion, aria) => {
    const html = renderToString(
      createElement(AjusteBiometriaVista, {
        tipo: "Face ID",
        activada,
        ocupado: false,
        onCambiar: nada,
      }),
    );
    expect(texto(html)).toContain(accion);
    expect(html).toContain(aria);
  });
});
