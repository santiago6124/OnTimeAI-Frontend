"use client";

import * as React from "react";

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

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as PaletteId | null;
    if (stored && PALETTES.some((p) => p.id === stored)) {
      setPaletteState(stored);
      document.documentElement.dataset.palette = stored;
    } else {
      document.documentElement.dataset.palette = DEFAULT_PALETTE;
    }
  }, []);

  const setPalette = React.useCallback((next: PaletteId) => {
    setPaletteState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.palette = next;
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
