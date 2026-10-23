"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { GOOGLE_WEB_CLIENT_ID, IS_BUNDLED } from "@/lib/mobile-env";
import {
  sesionConCredencialDeGoogle,
  sesionConGoogleNativo,
  type SesionDeGoogle,
} from "@/lib/auth-google";
import {
  googleDisponibleEn,
  googleNativoListo,
  plataformaActual,
} from "@/lib/native/google-sign-in";

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
 * Qué variante de botón puede dibujarse, según lo que se sabe en tiempo de
 * BUILD.
 *
 * - `web`: Google Identity Services, el único que funciona en un navegador.
 * - `nativo`: el plugin, que es el único que funciona en un WebView.
 * - `ninguno`: falta el client ID que ese camino necesita.
 */
type Variante = "web" | "nativo" | "ninguno";

const VARIANTE_DE_BUILD: Variante = IS_BUNDLED
  ? // El bundle solo lo compila iOS, así que acá la plataforma se sabe.
    googleDisponibleEn("ios")
    ? "nativo"
    : "ninguno"
  : GOOGLE_WEB_CLIENT_ID
    ? "web"
    : "ninguno";

/**
 * Si el botón de Google se va a dibujar. Quien pone un separador encima ("o con
 * tu correo") tiene que mirar esto: sin client ID el botón no existe y el
 * separador quedaría anunciando una alternativa que no está.
 *
 * No alcanza por sí sola en Android: ver `useGoogleSignInDisponible`.
 */
export const GOOGLE_SIGN_IN_AVAILABLE = VARIANTE_DE_BUILD !== "ninguno";

/**
 * La variante que corresponde de verdad, mirando también la plataforma.
 *
 * `IS_BUNDLED` es una bandera de BUILD y solo se prende para el bundle de iOS.
 * El shell de Android carga la web remota desde Cloud Run, así que ahí vale
 * `false` y el build cree que es "web". Pero Google Identity Services no corre
 * dentro de un WebView embebido: rechaza el flujo con `disallowed_useragent`.
 * Antes el usuario de Android veía un botón que no podía funcionar; después se
 * lo escondió; ahora recibe el nativo, que sí funciona.
 *
 * La comprobación tiene que ser de runtime porque la misma build sirve a la web
 * y al WebView de Android. El puente de Capacitor se inyecta también en modo
 * remoto, así que `isNativePlatform()` responde bien en las dos.
 *
 * Arranca en el valor de build y se corrige después de montar, no al revés: así
 * el primer render del cliente coincide con el del servidor y no hay desajuste
 * de hidratación. El costo es que en Android el botón de Google Identity
 * Services puede alcanzar a dibujarse un instante antes de ser reemplazado.
 */
export function useVarianteDeGoogle(): Variante {
  const [variante, setVariante] = useState<Variante>(VARIANTE_DE_BUILD);

  useEffect(() => {
    if (VARIANTE_DE_BUILD === "ninguno") return;
    let vivo = true;
    (async () => {
      const plataforma = await plataformaActual();
      if (plataforma === "web") return;
      // En nativo NO se cae a la variante web: Google Identity Services
      // rechaza el WebView igual. O el botón nativo, o ninguno.
      const listo = await googleNativoListo();
      if (vivo) setVariante(listo ? "nativo" : "ninguno");
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return variante;
}

/**
 * Compatibilidad con quien solo quiere saber si va a haber botón, que es el
 * caso de los separadores de las páginas de login y alta.
 */
export function useGoogleSignInDisponible(): boolean {
  return useVarianteDeGoogle() !== "ninguno";
}

export function GoogleSignInButton({
  onSession,
  onError,
  disabled = false,
}: {
  /** Recibe la sesión ya canjeada, sin importar por qué camino vino. */
  onSession: (session: SesionDeGoogle) => void;
  onError: (mensaje: string) => void;
  disabled?: boolean;
}) {
  const variante = useVarianteDeGoogle();

  if (variante === "nativo") {
    return (
      <BotonNativo onSession={onSession} onError={onError} disabled={disabled} />
    );
  }
  if (variante === "web") {
    return (
      <BotonDeGoogleIdentity
        onSession={onSession}
        onError={onError}
        disabled={disabled}
      />
    );
  }
  // Sin client ID la app sigue funcionando con correo y contraseña.
  return null;
}

/**
 * El botón del teléfono.
 *
 * Se dibuja a mano porque el plugin no trae uno: abre la hoja nativa de Google
 * y no hay nada que renderizar hasta que vuelve. El aspecto sigue las
 * directrices de marca de Google —fondo blanco, borde gris, la G de cuatro
 * colores, "Continuar con Google"— porque usar el logo con otro tratamiento es
 * motivo de rechazo en la revisión de App Store.
 */
function BotonNativo({
  onSession,
  onError,
  disabled,
}: {
  onSession: (session: SesionDeGoogle) => void;
  onError: (mensaje: string) => void;
  disabled: boolean;
}) {
  const [enCurso, setEnCurso] = useState(false);

  const entrar = useCallback(async () => {
    setEnCurso(true);
    try {
      onSession(await sesionConGoogleNativo());
    } catch (causa) {
      onError(
        causa instanceof Error
          ? causa.message
          : "No se pudo iniciar sesión con Google.",
      );
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
        "flex w-full items-center justify-center gap-3 rounded-md border",
        "border-[#747775] bg-white px-4 py-2.5",
        "text-sm font-medium text-[#1f1f1f]",
        "transition-colors hover:bg-[#f7f8f8] active:bg-[#eef0f1]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        bloqueado ? "pointer-events-none opacity-60" : "",
      ].join(" ")}
    >
      <LogoDeGoogle />
      {enCurso ? "Ingresando…" : "Continuar con Google"}
    </button>
  );
}

function LogoDeGoogle() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** El botón de la web, el que dibuja Google Identity Services. */
function BotonDeGoogleIdentity({
  onSession,
  onError,
  disabled,
}: {
  onSession: (session: SesionDeGoogle) => void;
  onError: (mensaje: string) => void;
  disabled: boolean;
}) {
  const clientId = GOOGLE_WEB_CLIENT_ID;
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // En un ref para que cambiar el callback no vuelva a montar el botón de
  // Google, que es un nodo que ese script dibuja una sola vez.
  const manejar = useRef<(idToken: string) => void>(() => {});
  useEffect(() => {
    manejar.current = (idToken: string) => {
      sesionConCredencialDeGoogle(idToken)
        .then(onSession)
        .catch((causa) =>
          onError(
            causa instanceof Error
              ? causa.message
              : "No se pudo iniciar sesión con Google.",
          ),
        );
    };
  }, [onSession, onError]);

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
            if (response.credential) manejar.current(response.credential);
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
