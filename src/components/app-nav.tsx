"use client";

/**
 * Navegación principal: una píldora con el logo y los destinos, siempre
 * abierta.
 *
 * Reemplaza a la barra lateral y al header. La primera versión arrancaba como
 * un círculo con el logo y se desplegaba al pasar el mouse; la interacción se
 * sacó porque escondía la navegación entera detrás de un gesto que hay que
 * descubrir, y en pantalla táctil no existe. Lo que quedó es una barra fija:
 * todo visible, sin estado, sin animación de apertura.
 *
 * Al no haber apertura tampoco hay nada que cerrar, así que se fueron el
 * estado, el manejo de foco, la tecla Escape y el cierre al navegar. Las
 * únicas transiciones que quedan son las de color al pasar por encima de cada
 * enlace.
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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/components/providers/profile-provider";
import { useSession } from "@/components/providers/session-provider";
import { apiLogout } from "@/lib/api";
import { REPORTS_ENABLED, appPath } from "@/lib/mobile-env";

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
    <span className="shrink-0 px-2 text-xs tabular-nums text-muted-foreground">
      {hora} UTC
    </span>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const { user } = useSession();

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

  async function cerrarSesion() {
    await apiLogout().catch(() => undefined);
    window.location.replace(appPath("/login"));
  }

  return (
    // `fixed` y no `sticky`: es lo que saca la barra del flujo. Mientras estaba
    // en el flujo ocupaba altura propia dentro de una banda opaca, así que el
    // contenido no podía pasarle por debajo —quedaba tapado por la banda— y la
    // página se leía como un bloque aparte que arrancaba más abajo. Fuera del
    // flujo, la píldora flota y el contenido le pasa por detrás al hacer
    // scroll. El hueco inicial lo pone `--nav-offset` desde `app-shell`.
    //
    // `pointer-events-none` en el contenedor y `auto` en la píldora: el
    // contenedor ocupa todo el ancho y sin esto se comería los clics de lo que
    // quedara debajo, a los costados de la píldora.
    //
    // `safe-top` y el espaciado van en elementos distintos a propósito. Los dos
    // escriben `padding-top`, pero `.safe-top` está definida fuera de toda capa
    // en globals.css y las utilidades de Tailwind viven en `@layer utilities`:
    // el CSS sin capa le gana a cualquier capa, así que puestas juntas
    // `env(safe-area-inset-top)` —que en escritorio vale 0— pisaba el padding y
    // la barra quedaba pegada al borde. Ver la nota en globals.css.
    <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-40">
      <div className="flex justify-center px-4 pt-3">
        <nav
          aria-label="Navegación principal"
          // `overflow-x-auto` es lo que salva al teléfono: con perfil de
          // operaciones y rol de superadmin son siete entradas más el reloj, y
          // eso no entra en 390 px de ancho. Sin scroll las últimas quedarían
          // fuera de alcance.
          className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border bg-background p-2 shadow-sm"
        >
          {/* El dibujo es blanco sobre transparente, así que sobre la píldora
              clara desaparecería; `brightness-0` lo lleva a negro sin tocar la
              transparencia, igual que en `brand-mark.tsx`.

              Va `/icon.png` (73 KB) y no `/logopagina.png` (1,3 MB, la misma
              figura a 1024 px): el navbar es lo primero que se pinta en todas
              las pantallas.

              eslint-disable-next-line @next/next/no-img-element --
              `next/image` mandaría el icono al optimizador en tiempo de
              ejecución para dibujarlo a 40 px: no compensa. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="OnTimeAI"
            width={40}
            height={40}
            className="mr-1 size-10 shrink-0 rounded-full object-cover brightness-0"
          />

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
                  "flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors",
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

          <UtcClock />

          {/* "Cerrar sesión" al final y separado: es la única acción irreversible
              de la fila y no conviene que quede a un píxel de un enlace de
              navegación.

              Sin texto hace falta el tooltip. El `aria-label` no alcanza por sí
              solo: una puerta con una flecha no dice qué hace a quien no la tiene
              asociada de antes, y hace falta que el nombre sea visible al
              enfocar, no solo anunciado por el lector de pantalla. */}
          {/* `data-vertical:self-center` y no `self-center` a secas: el primitivo
              trae `data-vertical:self-stretch`, y twMerge solo dedupea cuando el
              modificador coincide. Sin el prefijo sobreviven las dos y gana la
              del primitivo por especificidad, que con una altura fija no estira
              nada pero sí alinea la línea contra el borde de arriba. */}
          <Separator
            orientation="vertical"
            className="mx-2 h-6 shrink-0 data-vertical:self-center"
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="destructive"
                  size="icon-lg"
                  onClick={cerrarSesion}
                  aria-label="Cerrar sesión"
                  className="shrink-0 rounded-full"
                />
              }
            >
              <LogOut />
            </TooltipTrigger>
            <TooltipContent>Cerrar sesión</TooltipContent>
          </Tooltip>
        </nav>
      </div>
    </div>
  );
}
