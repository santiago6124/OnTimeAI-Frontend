"use client";

import { useCallback, useEffect, useState } from "react";

import { IS_BUNDLED } from "@/lib/mobile-env";
import {
  mensajeDeErrorDeApple,
  sesionConAppleNativo,
  type SesionDeApple,
} from "@/lib/auth-apple";
import { appleNativoListo } from "@/lib/native/apple-sign-in";

/**
 * Si el botón de Apple se dibuja en este teléfono.
 *
 * Arranca en `false` —que es lo que ve el servidor y la web— y se corrige
 * después de montar, como el de Google: así el primer render del cliente
 * coincide con el export estático y no hay desajuste de hidratación.
 *
 * Fuera del bundle ni pregunta. La web y el WebView de Android cargan el mismo
 * JS desde Cloud Run, pero ninguno compila con `IS_BUNDLED`, y el gate de
 * `apple-sign-in.ts` igual diría que no.
 */
export function useAppleSignInDisponible(): boolean {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!IS_BUNDLED) return;
    let vivo = true;
    appleNativoListo().then((ok) => {
      if (vivo) setListo(ok);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return listo;
}

/**
 * "Continuar con Apple", según las Human Interface Guidelines de Apple.
 *
 * Fondo negro, logo y texto blancos, el mismo alto y radio que el de Google:
 * la guía 4.8 pide que el login con Apple no quede menos visible que los otros
 * de terceros, y las HIG fijan el tratamiento del logo —usar otro es motivo de
 * rechazo, como con la G de Google—. Va ARRIBA de Google por eso.
 *
 * Quien lo usa decide si se dibuja con `useAppleSignInDisponible`, porque de
 * eso depende también el separador "o con tu correo".
 */
export function AppleSignInButton({
  onSession,
  onError,
  disabled = false,
}: {
  onSession: (session: SesionDeApple) => void;
  onError: (mensaje: string) => void;
  disabled?: boolean;
}) {
  const [enCurso, setEnCurso] = useState(false);

  const entrar = useCallback(async () => {
    setEnCurso(true);
    try {
      onSession(await sesionConAppleNativo());
    } catch (causa) {
      onError(mensajeDeErrorDeApple(causa));
    } finally {
      setEnCurso(false);
    }
  }, [onSession, onError]);

  const bloqueado = disabled || enCurso;

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={bloqueado}
      aria-busy={enCurso}
      className={[
        "flex w-full items-center justify-center gap-3 rounded-md",
        "border border-black bg-black px-4 py-2.5",
        "text-sm font-medium text-white",
        "transition-colors hover:bg-[#1f1f1f] active:bg-[#333]",
        // En tema oscuro el fondo de la app es casi negro: el borde gris
        // evita que el botón se funda con él. Las HIG admiten el contorno.
        "dark:border-[#5c5c5c]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        bloqueado ? "pointer-events-none opacity-60" : "",
      ].join(" ")}
    >
      <LogoDeApple />
      {enCurso ? "Ingresando…" : "Continuar con Apple"}
    </button>
  );
}

function LogoDeApple() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}
