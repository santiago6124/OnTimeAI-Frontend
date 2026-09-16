"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plane,
  Route,
  CloudSun,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useProfile } from "@/components/providers/profile-provider";
import { useSession } from "@/components/providers/session-provider";
import { REPORTS_ENABLED } from "@/lib/mobile-env";

const AIRLINE_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/flights", label: "Vuelos ATL", icon: Plane },
  { href: "/routes", label: "Historial por ruta", icon: Route },
  { href: "/weather", label: "Meteorología", icon: CloudSun },
];

/**
 * Entradas que dependen del rol y no del perfil.
 *
 * "Evolución del modelo" estaba en el menú de operaciones, y eso la escondía de
 * cualquier cuenta con perfil de viajero —incluida la de un administrador—
 * mientras la dejaba visible para un usuario común que eligiera operaciones.
 * El criterio del issue es el rol: admin y superadmin la ven, el resto no.
 */
const ADMIN_NAV = [
  { href: "/reports", label: "Evolución del modelo", icon: TrendingUp },
];

const PASSENGER_NAV = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/flights", label: "Buscar vuelo", icon: Plane },
  { href: "/weather", label: "Meteorología ATL", icon: CloudSun },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const { user } = useSession();
  const role = user?.role ?? "user";
  const esAdmin = role === "admin" || role === "superadmin";
  const nav = [
    ...(profile === "airline" ? AIRLINE_NAV : PASSENGER_NAV),
    // REPORTS_ENABLED es false solo en el bundle móvil, donde /reports no
    // existe (ver lib/mobile-env.ts).
    ...(esAdmin && REPORTS_ENABLED ? ADMIN_NAV : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-md overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logopagina.png" alt="OnTimeAI" className="size-8 object-cover" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold tracking-tight">
              OnTimeAI
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {profile === "airline" ? "Operaciones" : "Pasajero"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {role === "superadmin" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Usuarios"
                isActive={pathname.startsWith("/admin")}
                render={
                  <Link href="/admin/users">
                    <Users />
                    <span>Usuarios</span>
                  </Link>
                }
              />
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Ajustes"
              render={
                <Link href="/settings">
                  <Settings />
                  <span>Ajustes</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
