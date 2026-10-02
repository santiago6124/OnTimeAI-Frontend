"use client";

import * as React from "react";
import { useSession } from "@/components/providers/session-provider";
import { profileIdForUserType } from "@/lib/auth-types";

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

/** Local override, only meaningful for roles allowed to switch views. */
function getStoredProfile(): ProfileId | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "passenger" || stored === "airline" ? stored : null;
}

type ProfileContextValue = {
  profile: ProfileId;
  /** `null` vuelve a seguir el perfil de la cuenta. */
  setProfile: (profile: ProfileId | null) => void;
  /** Si hay un override local pisando al perfil de la cuenta. */
  overridden: boolean;
  /** El perfil que dicta la cuenta, sin el override. */
  accountProfile: ProfileId | null;
};

const ProfileContext = React.createContext<ProfileContextValue | undefined>(
  undefined,
);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const storedProfile = React.useSyncExternalStore(
    subscribe,
    getStoredProfile,
    () => null,
  );

  // The account's own segment (set during onboarding) is the source of truth.
  const accountProfile = user?.userType
    ? profileIdForUserType(user.userType)
    : null;
  // Operators and admins can still flip the view locally, e.g. to run a demo.
  const canSelectProfile =
    user?.role === "admin" || user?.role === "superadmin";

  const profile = canSelectProfile
    ? storedProfile ?? accountProfile ?? DEFAULT_PROFILE
    : accountProfile ?? "passenger";

  const setProfile = React.useCallback((next: ProfileId | null) => {
    if (!canSelectProfile) return;
    // `null` BORRA el override en vez de guardar un valor.
    //
    // Antes no habia forma de volver atras: el desplegable solo ofrecia
    // "airline" o "passenger", nunca "seguir mi cuenta", y lo guardado le gana
    // al perfil de la cuenta. Un admin que abriera el desplegable una vez
    // quedaba con la vista congelada en ese navegador para siempre, y cambiar
    // el perfil en Ajustes no hacia nada visible.
    if (next === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    listeners.forEach((listener) => listener());
  }, [canSelectProfile]);

  const value = React.useMemo(
    () => ({
      profile,
      setProfile,
      overridden: canSelectProfile && storedProfile !== null,
      accountProfile,
    }),
    [profile, setProfile, canSelectProfile, storedProfile, accountProfile],
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
