"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IS_BUNDLED } from "@/lib/mobile-env";

const GSI_SRC = "https://accounts.google.com/gsi/client";

type CredentialResponse = { credential?: string };

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
        auto_select?: boolean;
locale?: string;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gsi")));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(script);
  });
}

/**
 * Si el botón de Google se va a dibujar, según lo que se sabe en tiempo de
 * BUILD. Quien pone un separador encima ("o con tu correo") tiene que mirar
 * esto: sin client ID, o en el bundle nativo, el botón no existe y el separador
 * quedaría anunciando una alternativa que no está.
 *
 * No alcanza por sí sola en Android: ver `useGoogleSignInDisponible`.
 */
export const GOOGLE_SIGN_IN_AVAILABLE =
  Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) && !IS_BUNDLED;

/**
 * Lo mismo, pero mirando también en qué plataforma estamos corriendo.
 *
 * `IS_BUNDLED` es una bandera de BUILD y solo se prende para el bundle de iOS.
 * El shell de Android carga la web remota desde Cloud Run, así que ahí vale
 * `false` y el botón se dibujaba. Pero Google Identity Services no corre dentro
 * de un WebView embebido: rechaza el flujo con `disallowed_useragent`. El
 * usuario de Android veía un botón que no podía funcionar.
 *
 * La comprobación tiene que ser de runtime porque la misma build sirve a la web
 * y al WebView de Android. El puente de Capacitor se inyecta también en modo
 * remoto, así que `isNativePlatform()` responde bien en las dos.
 *
 * Arranca en el valor de build y se corrige después de montar, no al revés: así
 * el primer render del cliente coincide con el del servidor y no hay desajuste
 * de hidratación. El costo es que en Android el botón puede alcanzar a
 * dibujarse un instante.
 *
 * Es la mitigación hasta que entre el plugin nativo (#46), que necesita los
 * clientes OAuth de iOS y Android creados en la consola.
 */
export function useGoogleSignInDisponible(): boolean {
  const [disponible, setDisponible] = useState(GOOGLE_SIGN_IN_AVAILABLE);

  useEffect(() => {
    if (!GOOGLE_SIGN_IN_AVAILABLE) return;
    let vivo = true;
    import("@capacitor/core")
      .then(({ Capacitor }) => {
        if (vivo && Capacitor.isNativePlatform()) setDisponible(false);
      })
      // En la web el paquete está igual, pero si el import falla no hay motivo
      // para esconder el botón: la web es el caso en que sí funciona.
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  return disponible;
}

export function GoogleSignInButton({
  onCredential,
  disabled = false,
}: {
  onCredential: (idToken: string) => void;
  disabled?: boolean;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  // Va antes de cualquier return temprano: es un hook.
  const disponible = useGoogleSignInDisponible();
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        containerRef.current.replaceChildren();
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential);
          },
          auto_select: false,
          locale: "es",
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          locale: "es",
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Without a client ID the app keeps working with password login only. The
  // bundled app has no route handlers to exchange the token, and Google blocks
  // its web flow inside embedded webviews anyway: that needs the native plugin.
  //
  // `disponible` agrega el caso de Android, que corre la web remota en un
  // WebView: ahí `IS_BUNDLED` es false pero Google rechaza igual el flujo.
  if (!clientId || IS_BUNDLED || !disponible) return null;

  if (failed) {
    return (
      <p className="text-sm text-muted-foreground">
        No se pudo cargar el acceso con Google. Ingresá con usuario y contraseña.
      </p>
    );
  }

  // Sin separador propio: quien lo usa decide si hace falta y con que texto.
  return (
    <div
      id={containerId}
      ref={containerRef}
      aria-busy={disabled}
      className={[
        "flex justify-center",
        "[&>div]:overflow-hidden [&>div]:rounded",
        disabled ? "pointer-events-none opacity-60" : "",
      ].join(" ")}
    />
  );
}
