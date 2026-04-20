"use client";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import {
  PALETTES,
  usePalette,
} from "@/components/providers/palette-provider";
import { PROFILES, useProfile } from "@/components/providers/profile-provider";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const { profile, setProfile } = useProfile();

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
            <CardTitle className="text-base">Perfil de uso</CardTitle>
            <CardDescription>
              Controla qué vistas y filtros se priorizan en la UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {PROFILES.map((p) => (
              <button
                key={p.id}
                onClick={() => setProfile(p.id)}
                className={cn(
                  "text-left rounded-lg border p-3 transition-colors",
                  profile === p.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-foreground/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.description}
                    </div>
                  </div>
                  {profile === p.id ? (
                    <Check className="size-4 text-primary" />
                  ) : null}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

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
                onClick={() => setTheme(mode)}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tokens CSS</CardTitle>
            <CardDescription>
              Toda la paleta vive en <code>src/app/globals.css</code> como
              variables OKLCH. Podés definir nuevas paletas agregando bloques{" "}
              <code>html[data-palette=&quot;tu-id&quot;]</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Ejemplo
            </Label>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[11px] text-muted-foreground">
{`html[data-palette="custom"] {
  --primary: oklch(0.6 0.2 300);
  --ring: oklch(0.7 0.18 300);
  --sidebar-primary: oklch(0.6 0.2 300);
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
