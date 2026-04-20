"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plane,
  Route,
  CloudSun,
  FileText,
  Settings,
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

const AIRLINE_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/flights", label: "Vuelos ATL", icon: Plane },
  { href: "/routes", label: "Historial por ruta", icon: Route },
  { href: "/weather", label: "Meteorología", icon: CloudSun },
  { href: "/reports", label: "Reportes", icon: FileText },
];

const PASSENGER_NAV = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/flights", label: "Buscar vuelo", icon: Plane },
  { href: "/weather", label: "Meteorología ATL", icon: CloudSun },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const nav = profile === "airline" ? AIRLINE_NAV : PASSENGER_NAV;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Plane className="size-4" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold tracking-tight">
              OnTimeAI
            </div>
            <div className="text-xs text-muted-foreground">ATL Operations</div>
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
