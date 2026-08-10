"use client";

import * as React from "react";
import { useSession } from "@/components/providers/session-provider";

export type ProfileId = "airline" | "passenger";

export const PROFILES: Array<{
  id: ProfileId;
  label: string;
  description: string;
}> = [
  {
    id: "airline",
    label: "Aerolínea / Operador",
    description: "Gestión operativa de la flota en ATL",
  },
  {
    id: "passenger",
    label: "Pasajero",
    description: "Consulta de riesgo de retraso de mi vuelo",
  },
];

const STORAGE_KEY = "ontimeai-profile";
const DEFAULT_PROFILE: ProfileId = "airline";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getStoredProfile(): ProfileId {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "passenger" || stored === "airline"
    ? stored
    : DEFAULT_PROFILE;
}

type ProfileContextValue = {
  profile: ProfileId;
  setProfile: (profile: ProfileId) => void;
};

const ProfileContext = React.createContext<ProfileContextValue | undefined>(
  undefined,
);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const storedProfile = React.useSyncExternalStore(
    subscribe,
    getStoredProfile,
    () => DEFAULT_PROFILE,
  );
  const canSelectProfile =
    user?.role === "admin" || user?.role === "superadmin";
  const profile = canSelectProfile ? storedProfile : "passenger";

  const setProfile = React.useCallback((next: ProfileId) => {
    if (!canSelectProfile) return;
    window.localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach((listener) => listener());
  }, [canSelectProfile]);

  const value = React.useMemo(
    () => ({ profile, setProfile }),
    [profile, setProfile],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = React.useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
