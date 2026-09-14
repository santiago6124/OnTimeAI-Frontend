"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, Plane } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { apiSetUserType } from "@/lib/api";
import { homePathFor, safeReturnPath, type UserType } from "@/lib/auth-types";

const PROFILES: {
  value: UserType;
  title: string;
  description: string;
  icon: typeof Plane;
}[] = [
  {
    value: "b2c",
    title: "Soy viajero",
    description: "Quiero saber si mi vuelo se va a retrasar.",
    icon: Plane,
  },
  {
    value: "b2b",
    title: "Trabajo en operaciones",
    description: "Monitoreo la operación del aeropuerto o mi flota.",
    icon: LayoutDashboard,
  },
];

function ProfilePicker() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<UserType | null>(null);
  const [isPending, startTransition] = useTransition();

  const requestedPath = searchParams.get("from");

  function choose(userType: UserType) {
    setError("");
    setSelected(userType);
    startTransition(async () => {
      try {
        await apiSetUserType(userType);
        window.location.replace(
          requestedPath ? safeReturnPath(requestedPath) : homePathFor(userType),
        );
      } catch (cause) {
        setSelected(null);
        setError(
          cause instanceof Error ? cause.message : "No se pudo guardar el perfil.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {PROFILES.map(({ value, title, description, icon: Icon }) => (
          <Card key={value} className="transition-colors hover:border-primary">
            <CardContent className="p-0">
              <button
                type="button"
                onClick={() => choose(value)}
                disabled={isPending}
                aria-busy={selected === value}
                className="flex h-full w-full flex-col items-start gap-2 rounded-lg p-5 text-left disabled:opacity-60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <span className="text-base font-semibold">{title}</span>
                <span className="text-sm text-muted-foreground">{description}</span>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-center text-xs text-muted-foreground">
        Podés cambiarlo después desde Configuración.
      </p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            ¿Cómo vas a usar OnTimeAI?
          </h1>
          <p className="text-sm text-muted-foreground">
            Elegí tu perfil para mostrarte la vista que te sirve.
          </p>
        </div>

        <Suspense
          fallback={<div className="h-40 animate-pulse rounded-lg bg-muted" />}
        >
          <ProfilePicker />
        </Suspense>
      </div>
    </div>
  );
}
