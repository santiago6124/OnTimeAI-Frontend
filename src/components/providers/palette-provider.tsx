"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { useSession } from "@/components/providers/session-provider";

export const PALETTES = [
  { id: "operations", label: "Operations", swatch: "#3b82f6" },
  { id: "tower", label: "Tower", swatch: "#f59e0b" },
  { id: "ocean", label: "Ocean", swatch: "#06b6d4" },
  { id: "forest", label: "Forest", swatch: "#10b981" },
  { id: "sunset", label: "Sunset", swatch: "#f43f5e" },
  { id: "mono", label: "Monochrome", swatch: "#a1a1aa" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

const STORAGE_KEY = "ontimeai-palette";
const DEFAULT_PALETTE: PaletteId = "operations";

type PaletteContextValue = {
  palette: PaletteId;
  setPalette: (palette: PaletteId) => void;
};

const PaletteContext = React.createContext<PaletteContextValue | undefined>(
  undefined,
);

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = React.useState<PaletteId>(DEFAULT_PALETTE);
  const { setTheme } = useTheme();
  const { user } = useSession();

  React.useEffect(() => {
    function applyLocalFallback() {
      const stored = window.localStorage.getItem(STORAGE_KEY) as PaletteId | null;
      const p = stored && PALETTES.some((x) => x.id === stored) ? stored : DEFAULT_PALETTE;
      setPaletteState(p as PaletteId);
      document.documentElement.dataset.palette = p;
    }

    if (!user) { applyLocalFallback(); return; }

    api.getPreferences()
      .then((prefs) => {
        const p = PALETTES.some((x) => x.id === prefs.palette) ? prefs.palette as PaletteId : DEFAULT_PALETTE;
        setPaletteState(p);
        document.documentElement.dataset.palette = p;
        window.localStorage.setItem(STORAGE_KEY, p);
        if (prefs.theme) setTheme(prefs.theme);
      })
      .catch(applyLocalFallback);
  }, [setTheme, user]);

  const setPalette = React.useCallback((next: PaletteId) => {
    setPaletteState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.palette = next;
    api.updatePreferences({ palette: next }).catch(() => {});
  }, []);

  const value = React.useMemo(
    () => ({ palette, setPalette }),
    [palette, setPalette],
  );

  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  );
}

export function usePalette() {
  const ctx = React.useContext(PaletteContext);
  if (!ctx) throw new Error("usePalette must be used within PaletteProvider");
  return ctx;
}
