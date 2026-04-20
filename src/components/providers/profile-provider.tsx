"use client";

import * as React from "react";

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

type ProfileContextValue = {
  profile: ProfileId;
  setProfile: (profile: ProfileId) => void;
};

const ProfileContext = React.createContext<ProfileContextValue | undefined>(
  undefined,
);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] =
    React.useState<ProfileId>(DEFAULT_PROFILE);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(
      STORAGE_KEY,
    ) as ProfileId | null;
    if (stored === "airline" || stored === "passenger") {
      setProfileState(stored);
    }
  }, []);

  const setProfile = React.useCallback((next: ProfileId) => {
    setProfileState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

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
