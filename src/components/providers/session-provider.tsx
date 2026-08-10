"use client";

import * as React from "react";

import type { SessionUser } from "@/lib/auth-types";

type SessionContextValue = {
  user: SessionUser | null;
};

const SessionContext = React.createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    // Remove tokens left by versions prior to the HttpOnly-cookie migration.
    window.localStorage.removeItem("ontimeai-auth-token");
  }, []);

  const value = React.useMemo(() => ({ user }), [user]);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const value = React.useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
