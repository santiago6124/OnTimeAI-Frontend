"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  PALETTES,
  usePalette,
  type PaletteId,
} from "@/components/providers/palette-provider";

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const current = mounted ? (resolvedTheme ?? theme) : "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Cambiar apariencia"
            className="relative"
          />
        }
      >
        {current === "dark" ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Modo</DropdownMenuLabel>
          <ModeItem
            icon={<Sun className="size-4" />}
            label="Claro"
            active={theme === "light"}
            onSelect={() => setTheme("light")}
          />
          <ModeItem
            icon={<Moon className="size-4" />}
            label="Oscuro"
            active={theme === "dark"}
            onSelect={() => setTheme("dark")}
          />
          <ModeItem
            icon={<Monitor className="size-4" />}
            label="Sistema"
            active={theme === "system"}
            onSelect={() => setTheme("system")}
          />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            <Palette className="size-4" />
            Paleta de colores
          </DropdownMenuLabel>
          {PALETTES.map((p) => (
            <PaletteItem
              key={p.id}
              id={p.id}
              label={p.label}
              swatch={p.swatch}
              active={palette === p.id}
              onSelect={() => setPalette(p.id)}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModeItem({
  icon,
  label,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="gap-2">
      {icon}
      <span className="flex-1">{label}</span>
      {active ? <Check className="size-4 opacity-70" /> : null}
    </DropdownMenuItem>
  );
}

function PaletteItem({
  id,
  label,
  swatch,
  active,
  onSelect,
}: {
  id: PaletteId;
  label: string;
  swatch: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="gap-2">
      <span
        className="size-4 rounded-full ring-1 ring-border"
        style={{ backgroundColor: swatch }}
        aria-hidden
      />
      <span className="flex-1">{label}</span>
      {active ? <Check className="size-4 opacity-70" /> : null}
      <span className="sr-only">{id}</span>
    </DropdownMenuItem>
  );
}
