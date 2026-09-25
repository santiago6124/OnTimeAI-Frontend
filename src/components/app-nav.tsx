"use client";

/**
 * Navegación principal: un círculo con el logo que se abre al pasar el mouse.
 *
 * Reemplaza a la barra lateral y al header. En reposo la única cosa en
 * pantalla es el logo; al abrirse, la píldora crece hacia la derecha y aparecen
 * los destinos, y "Cerrar sesión" queda al final separado del resto, porque es
 * la única acción destructiva de la fila y no quiere estar pegada a un enlace.
 *
 * El ancho se anima con `grid-template-columns` de `0fr` a `1fr` en vez de con
 * `max-width`. La diferencia importa: con `max-width` hay que adivinar un tope,
 * y el menú cambia de largo según el perfil y el rol —un superadmin en perfil
 * de operaciones tiene el doble de entradas que un viajero—, así que cualquier
 * número elegido a mano recorta de más o deja la animación a los saltos. Con
 * `0fr → 1fr` el destino lo calcula el navegador a partir del contenido real.
 *
 * La apertura la maneja React y no `group-hover` de CSS, para que
 * `aria-expanded` del botón diga la verdad: con hover puro el atributo se
 * quedaría en "false" mientras el menú está abierto, que es peor que no
 * ponerlo. De paso, el mismo estado sirve para el tacto, donde no hay hover:
 * ahí se abre tocando el logo.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudSun,
  LayoutDashboard,
  LogOut,
  Plane,
  Route,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useProfile } from "@/components/providers/profile-provider";
import { useSession } from "@/components/providers/session-provider";
import { apiLogout } from "@/lib/api";
import { LIVE_ENABLED, REPORTS_ENABLED, appPath } from "@/lib/mobile-env";

type Entrada = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_OPERACIONES: Entrada[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/flights", label: "Vuelos ATL", icon: Plane },
  { href: "/routes", label: "Rutas", icon: Route },
  { href: "/weather", label: "Meteorología", icon: CloudSun },
];

const NAV_VIAJERO: Entrada[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/flights", label: "Buscar vuelo", icon: Plane },
  { href: "/weather", label: "Meteorología", icon: CloudSun },
];

/**
 * "Evolución del modelo" se decide por rol y no por perfil: un administrador
 * que mira la app como viajero la sigue necesitando, y un usuario común que
 * elige operaciones no.
 */
const NAV_ADMIN: Entrada[] = [
  { href: "/reports", label: "Evolución del modelo", icon: TrendingUp },
];

function UtcClock() {
  const [hora, setHora] = React.useState("");

  React.useEffect(() => {
    function tick() {
      const ahora = new Date();
      const hh = ahora.getUTCHours().toString().padStart(2, "0");
      const mm = ahora.getUTCMinutes().toString().padStart(2, "0");
      const ss = ahora.getUTCSeconds().toString().padStart(2, "0");
      setHora(`${hh}:${mm}:${ss}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!hora) return null;
  return (
    <span className="px-2 text-xs tabular-nums text-muted-foreground">
      {hora} UTC
    </span>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const { user } = useSession();
  const [abierto, setAbierto] = React.useState(false);

  const rol = user?.role ?? "user";
  const esAdmin = rol === "admin" || rol === "superadmin";

  const entradas: Entrada[] = [
    ...(profile === "airline" ? NAV_OPERACIONES : NAV_VIAJERO),
    // REPORTS_ENABLED es false solo en el bundle de iOS, donde /reports no se
    // compila. Ver lib/mobile-env.ts.
    ...(esAdmin && REPORTS_ENABLED ? NAV_ADMIN : []),
    { href: "/settings", label: "Ajustes", icon: Settings },
    ...(rol === "superadmin"
      ? [{ href: "/admin/users", label: "Usuarios", icon: Users }]
      : []),
  ];

  // Navegar cierra el menú: si no, al volver el foco a la página la píldora
  // queda abierta tapando el encabezado de la pantalla recién cargada.
  //
  // Va durante el render y no en un efecto. Con un efecto, React pinta primero
  // la pantalla nueva con el menú todavía abierto y recién después lo cierra,
  // que es un parpadeo visible; además dispara un segundo render en cascada.
  // Este es el patrón que documenta React para ajustar estado cuando cambia
  // una prop: comparar contra el valor anterior y corregir en el acto.
  const [rutaPrevia, setRutaPrevia] = React.useState(pathname);
  if (rutaPrevia !== pathname) {
    setRutaPrevia(pathname);
    setAbierto(false);
  }

  React.useEffect(() => {
    if (!abierto) return;
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  async function cerrarSesion() {
    await apiLogout().catch(() => undefined);
    window.location.replace(appPath("/login"));
  }

  return (
    <div className="safe-top sticky top-0 z-40 flex justify-center bg-background px-4 py-3">
      <nav
        aria-label="Navegación principal"
        data-abierto={abierto ? "true" : "false"}
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        onFocus={() => setAbierto(true)}
        // `relatedTarget` es a dónde se va el foco. Si sigue adentro de la
        // píldora —tabulando de un enlace al siguiente— no hay que cerrar.
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setAbierto(false);
          }
        }}
        className="flex max-w-full items-center rounded-full border bg-background p-2 shadow-sm transition-shadow duration-200 data-[abierto=true]:shadow-md"
      >
        <button
          type="button"
          aria-expanded={abierto}
          aria-label={abierto ? "Cerrar navegación" : "Abrir navegación"}
          onClick={() => setAbierto((v) => !v)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* El dibujo es blanco sobre transparente, asi que sobre la pildora
              clara desapareceria; `brightness-0` lo lleva a negro sin tocar la
              transparencia, igual que en `brand-mark.tsx`.

              Va `/icon.png` (73 KB) y no `/logopagina.png` (1,3 MB, la misma
              figura a 1024 px). La barra lateral podia permitirse la grande
              porque solo aparecia despues de entrar; el navbar es lo primero
              que se pinta en todas las pantallas.

              eslint-disable-next-line @next/next/no-img-element --
              `next/image` mandaria el icono al optimizador en tiempo de
              ejecucion para dibujarlo a 40 px: no compensa. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="OnTimeAI"
            width={40}
            height={40}
            className="size-10 rounded-full object-cover brightness-0"
          />
        </button>

        <div className="grid min-w-0 grid-cols-[0fr] transition-[grid-template-columns] duration-300 ease-out data-[abierto=true]:grid-cols-[1fr]" data-abierto={abierto ? "true" : "false"}>
          {/* Cerrada, `overflow-hidden`: con `auto` el navegador puede
              reservar la franja del scrollbar horizontal aunque la columna
              mida cero. Abierta pasa a `auto`, que es lo que salva al
              telefono: siete entradas no entran en 390 px de ancho y sin
              scroll las ultimas quedarian inalcanzables. */}
          <div className="overflow-y-hidden overflow-hidden data-[abierto=true]:overflow-x-auto" data-abierto={abierto ? "true" : "false"}>
            <div className="flex items-center gap-1 whitespace-nowrap pl-2">
              {entradas.map((item) => {
                const Icon = item.icon;
                const activo =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={activo ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
                      activo
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}

              {/* La vista Lite (/live) es la versión pública y simplificada.
                  No existe en el bundle de iOS. */}
              {LIVE_ENABLED && (
                <Link
                  href="/live"
                  className="flex h-10 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  Lite
                </Link>
              )}

              <UtcClock />

              {/* "Cerrar sesión" al final y separado: es la única acción
                  irreversible de la fila y no conviene que quede a un píxel de
                  un enlace de navegación. */}
              <Separator orientation="vertical" className="mx-3 h-6" />
              <button
                type="button"
                onClick={cerrarSesion}
                className="flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4 shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
