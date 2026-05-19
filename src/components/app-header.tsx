"use client";

import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, LogOut } from "lucide-react";
import { clearToken } from "@/lib/auth";

export function AppHeader({ title }: { title?: string }) {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {title ?? "Dashboard"}
        </span>
        <Badge variant="outline" className="gap-1 font-mono text-[10px]">
          <Radio className="size-3 text-risk-low" />
          ATL · KATL
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ProfileSwitcher />
        <ThemeSwitcher />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title="Cerrar sesión"
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
