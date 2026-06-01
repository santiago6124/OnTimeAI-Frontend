"use client";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import {
  PALETTES,
  usePalette,
} from "@/components/providers/palette-provider";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  function handleSetTheme(t: string) {
    setTheme(t);
    api.updatePreferences({ theme: t }).catch(() => {});
  }
  const { palette, setPalette } = usePalette();

  return (
    <AppShell title="Ajustes">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-sm text-muted-foreground">
            Personalizá la apariencia y el perfil de uso del dashboard.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modo de color</CardTitle>
            <CardDescription>
              Dark, light o sistema. El dark está optimizado para centros de
              operaciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(["light", "dark", "system"] as const).map((mode) => (
              <Button
                key={mode}
                variant={theme === mode ? "default" : "outline"}
                onClick={() => handleSetTheme(mode)}
                className="capitalize"
              >
                {mode === "system" ? "Sistema" : mode === "dark" ? "Oscuro" : "Claro"}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paleta de colores</CardTitle>
            <CardDescription>
              Cambia la paleta de acento sin modificar el modo claro/oscuro.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPalette(p.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  palette === p.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-foreground/30",
                )}
              >
                <span
                  className="size-5 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: p.swatch }}
                  aria-hidden
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.id}
                  </div>
                </div>
                {palette === p.id ? (
                  <Check className="size-4 text-primary" />
                ) : null}
              </button>
            ))}
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}
