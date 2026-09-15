"use client";

/**
 * Alta propia con correo y contraseña.
 *
 * Hasta ahora solo un superadmin podía crear estas cuentas, mientras que
 * cualquiera con cuenta de Google se registraba solo. El sistema ya era
 * abierto; esto quita la asimetría.
 */

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { apiRegister, apiLoginGoogle } from "@/lib/api";
import { homePathFor, safeReturnPath } from "@/lib/auth-types";

/** Lo exige el backend; se valida acá también para no gastar un viaje. */
const MIN_PASSWORD_LENGTH = 10;

function SignupForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const requestedPath = searchParams.get("from");
  const onboardingPath = requestedPath
    ? `/onboarding?from=${encodeURIComponent(safeReturnPath(requestedPath))}`
    : "/onboarding";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    startTransition(async () => {
      try {
        await apiRegister(email, password);
        window.location.replace(onboardingPath);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "No se pudo crear la cuenta.",
        );
      }
    });
  }

  function handleGoogleCredential(idToken: string) {
    setError("");
    startTransition(async () => {
      try {
        const session = await apiLoginGoogle(idToken);
        if (session.isNewUser) {
          window.location.replace(onboardingPath);
          return;
        }
        window.location.replace(
          requestedPath
            ? safeReturnPath(requestedPath)
            : homePathFor(session.userType),
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo continuar con Google.",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Crear cuenta</CardTitle>
        <CardDescription>
          Después vas a elegir si la usás para una empresa o de forma personal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Al menos {MIN_PASSWORD_LENGTH} caracteres.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creando..." : "Crear cuenta"}
          </Button>
        </form>

        <div className="mt-4">
          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            disabled={isPending}
          />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Ingresá
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Plane className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">OnTimeAI</h1>
          <p className="text-sm text-muted-foreground">
            Predicción de retrasos · ATL
          </p>
        </div>

        <Suspense
          fallback={<div className="h-80 animate-pulse rounded-lg bg-muted" />}
        >
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
