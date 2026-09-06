"use client";

import * as React from "react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Radio, LogOut } from "lucide-react";
import { apiLogout } from "@/lib/api";
import { LIVE_ENABLED } from "@/lib/mobile-env";

function UtcClock() {
  const [time, setTime] = React.useState("");

  React.useEffect(() => {
    function tick() {
      const now = new Date();
      const hh = now.getUTCHours().toString().padStart(2, "0");
      const mm = now.getUTCMinutes().toString().padStart(2, "0");
      const ss = now.getUTCSeconds().toString().padStart(2, "0");
      setTime(`${hh}:${mm}:${ss}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;
  return (
    <Badge variant="outline" className="gap-1 font-mono text-[10px] tabular-nums">
      <Clock className="size-3 text-muted-foreground" />
      {time} UTC
    </Badge>
  );
}

export function AppHeader({ title }: { title?: string }) {
  async function handleLogout() {
    await apiLogout().catch(() => undefined);
    window.location.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {title ?? "Dashboard"}
        </span>
        <Badge variant="outline" className="hidden gap-1 font-mono text-[10px] sm:flex">
          <Radio className="size-3 text-risk-low" />
          ATL · KATL
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <div className="hidden sm:block"><UtcClock /></div>

        {/* Lite / Pro mode toggle. En el bundle nativo /live no se compila
            (su layout lee cookies() en el servidor), así que el toggle entero
            se va: dejar "Pro" solo sugiere que hay otro modo al que no se
            puede llegar. Ver LIVE_ENABLED en lib/mobile-env.ts. */}
        {LIVE_ENABLED && (
          <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5 text-xs">
            <Link
              href="/live"
              className="px-2.5 py-1 rounded-full font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Lite
            </Link>
            <span className="px-2.5 py-1 rounded-full bg-background font-semibold shadow-sm">
              Pro
            </span>
          </div>
        )}

        <ThemeSwitcher />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
