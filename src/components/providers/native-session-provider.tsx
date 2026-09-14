"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { apiMe } from "@/lib/api";
import { appPath } from "@/lib/mobile-env";
import type { SessionUser } from "@/lib/auth-types";
import { SessionProvider } from "@/components/providers/session-provider";

/**
 * Resuelve la sesión del lado del cliente y guarda las rutas privadas.
 *
 * Es el reemplazo de `src/proxy.ts` en el bundle empaquetado. En la web ese
 * archivo corre en el servidor antes de cada request: si no hay cookie, redirige
 * a /login sin que el navegador llegue a ver la página. Un export estático no
 * tiene dónde correr eso — los HTML ya están escritos y el teléfono los abre
 * desde el disco—, así que el corte se hace acá, al montar.
 *
 * La diferencia de garantías hay que decirla: esto NO es un control de acceso.
 * Cualquiera con el .ipa puede leer el HTML de /admin sin autenticarse. Lo que
 * lo hace irrelevante es que esos HTML no traen datos adentro: todo lo que se
 * muestra sale de llamadas al backend que el propio backend autoriza por rol.
 * Sin token no hay datos, y con un token de rol `user` el backend devuelve 403.
 * Este gate es UX —no mostrar un dashboard vacío—, y la autorización real vive
 * donde siempre vivió.
 *
 * El árbol se monta recién cuando la sesión está resuelta. Renderizar los hijos
 * antes haría que cada página dispare sus fetch con el token todavía sin leer
 * del almacenamiento nativo, y todas cobrarían un 401 en el arranque.
 */
export function NativeSessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginRoute = pathname?.startsWith("/login") ?? false;

  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [status, setStatus] = React.useState<"resolving" | "ready" | "failed">(
    "resolving",
  );
  const [failure, setFailure] = React.useState("");

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { loadToken, clearToken } = await import(
          "@/lib/native/session"
        );
        const token = await loadToken();

        let session: SessionUser | null = null;
        if (token) {
          try {
            session = await apiMe();
          } catch {
            // El token no sirve (expiró, o el backend lo rechaza). `get()` ya
            // lo borró si la respuesta fue 401; para cualquier otra falla lo
            // limpiamos acá, porque una sesión que no se puede validar no es
            // una sesión.
            await clearToken();
            session = null;
          }
        }

        if (!alive) return;

        // Las mismas dos reglas que aplica proxy.ts en la web.
        if (!session && !isLoginRoute) {
          window.location.replace(appPath("/login"));
          return;
        }
        if (session && isLoginRoute) {
          window.location.replace(appPath("/"));
          return;
        }

        setUser(session);
        setStatus("ready");
      } catch (error) {
        // Sin este catch cualquier falla acá —un chunk que no carga, el puente
        // nativo que no responde— dejaba la promesa rechazada sin que nadie la
        // observe, `status` en "resolving" para siempre, y la app en una
        // pantalla vacía indistinguible de un cuelgue. Un arranque que falla
        // tiene que poder decirlo.
        if (!alive) return;
        setFailure(error instanceof Error ? error.message : String(error));
        setStatus("failed");
      }
    })();

    return () => {
      alive = false;
    };
    // Corre una sola vez por arranque: las navegaciones internas son del router
    // de Next y no vuelven a montar el layout raíz. Revalidar en cada cambio de
    // ruta pagaría un /auth/me por navegación sin agregar garantía — el backend
    // valida el token en cada llamada de todos modos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (status === "resolving") return;
    // Hay una pantalla real arriba —o una que explica por qué no la hay—:
    // bajar el splash y confirmarle el bundle a Capgo. También en el caso de
    // error, porque un splash que no baja nunca es peor que un mensaje.
    void import("@/lib/native/app-ready").then((m) => m.notifyAppReady());
  }, [status]);

  if (status === "failed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          No se pudo iniciar la app
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {failure || "Error desconocido al resolver la sesión."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Mientras resuelve, el splash nativo sigue tapando la pantalla. Este fondo
  // es lo que evita el flash blanco en el instante entre que el splash baja y
  // React pinta.
  if (status === "resolving") {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  return <SessionProvider user={user}>{children}</SessionProvider>;
}
