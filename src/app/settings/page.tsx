"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";
import { apiDeleteAccount, apiSetUserType } from "@/lib/api";
import { appPath } from "@/lib/mobile-env";
import { cn } from "@/lib/utils";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { SystemHealthCard } from "@/components/system-health-card";
import { useSession } from "@/components/providers/session-provider";
import { type UserType } from "@/lib/auth-types";

const ACCOUNT_PROFILES: { value: UserType; label: string; description: string }[] = [
  {
    value: "b2c",
    label: "Viajero",
    description: "Consulto el riesgo de retraso de mi vuelo",
  },
  {
    value: "b2b",
    label: "Operaciones",
    description: "Monitoreo la operación del aeropuerto o mi flota",
  },
];

export default function SettingsPage() {
  const { user } = useSession();
  const [userType, setUserType] = useState<UserType | null | undefined>(
    user?.userType,
  );
  const [profileError, setProfileError] = useState("");
  const [savingProfile, startSavingProfile] = useTransition();

  function handleSetUserType(next: UserType) {
    setProfileError("");
    const previous = userType;
    setUserType(next);
    startSavingProfile(async () => {
      try {
        await apiSetUserType(next);
        // The sidebar and landing route read this from the server session.
        window.location.reload();
      } catch (cause) {
        setUserType(previous);
        setProfileError(
          cause instanceof Error ? cause.message : "No se pudo guardar el perfil.",
        );
      }
    });
  }

  const [deleteError, setDeleteError] = useState("");
  const [deleting, startDeleting] = useTransition();

  function handleDeleteAccount() {
    setDeleteError("");
    startDeleting(async () => {
      try {
        await apiDeleteAccount();
        // La sesión ya no existe de ningún lado; el login es el único lugar
        // con sentido. replace, para que "atrás" no vuelva a una cuenta muerta.
        window.location.replace(appPath("/login"));
      } catch (cause) {
        setDeleteError(
          cause instanceof Error ? cause.message : "No se pudo eliminar la cuenta.",
        );
      }
    });
  }

  return (
    <AppShell title="Ajustes">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-sm text-muted-foreground">
            Elegí con qué vista abrís OnTimeAI y administrá tu cuenta.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tu perfil</CardTitle>
            <CardDescription>
              Define con qué vista abrís OnTimeAI. Queda guardado en tu cuenta,
              así te sigue en cualquier dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {ACCOUNT_PROFILES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSetUserType(option.value)}
                disabled={savingProfile}
                aria-pressed={userType === option.value}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                  userType === option.value
                    ? "border-primary bg-primary/5"
                    : "hover:border-foreground/30",
                )}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {option.description}
                  </div>
                </div>
                {userType === option.value ? (
                  <Check className="size-4 text-primary" />
                ) : null}
              </button>
            ))}
            {profileError ? (
              <p className="text-sm text-destructive sm:col-span-2">{profileError}</p>
            ) : null}
          </CardContent>
        </Card>

        {(user?.role === "admin" || user?.role === "superadmin") ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cambiar de vista</CardTitle>
              <CardDescription>
                Cambio temporal solo en este navegador, para demos. No modifica el perfil de tu cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileSwitcher />
            </CardContent>
          </Card>
        ) : null}

        {/* GET /admin/db-stats exige superadmin en el backend (_require_superadmin). */}
        {user?.role === "superadmin" ? <SystemHealthCard /> : null}

        {/* Las tiendas exigen que la baja exista dentro de la app (App Store
            5.1.1, Play "Account deletion"), no solo por correo. Va última:
            es lo que menos se usa y lo que más cuesta deshacer. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuenta</CardTitle>
            <CardDescription>
              Estás como <span className="font-medium text-foreground">{user?.username}</span>.
              Qué guardamos y por qué está en la{" "}
              <Link href="/privacidad" className="underline underline-offset-4">
                política de privacidad
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Dialog>
              <DialogTrigger
                render={<Button variant="destructive" disabled={deleting} />}
              >
                {deleting ? "Eliminando…" : "Eliminar cuenta"}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
                  <DialogDescription>
                    Se borran tu correo, tu perfil y tus preferencias. Es
                    inmediato y no se puede deshacer; para volver vas a tener
                    que crear una cuenta nueva.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancelar
                  </DialogClose>
                  <DialogClose
                    render={<Button variant="destructive" />}
                    onClick={handleDeleteAccount}
                  >
                    Sí, eliminar
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {deleteError && (
              <p role="alert" className="text-sm text-destructive">
                {deleteError}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
