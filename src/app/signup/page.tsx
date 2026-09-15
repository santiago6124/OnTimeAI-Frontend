"use client";

/**
 * Alta propia.
 *
 * Pide la contraseña dos veces: es la única de las dos pantallas donde un
 * error de tipeo queda grabado. En el acceso, equivocarse cuesta un reintento;
 * acá deja una cuenta cuya contraseña nadie conoce, y sin verificación por
 * correo no hay forma de recuperarla.
 */

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthShell, AuthDivider } from "@/components/auth-shell";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { apiRegister, apiLoginGoogle } from "@/lib/api";
import { homePathFor, safeReturnPath } from "@/lib/auth-types";

/** Lo exige el backend; se valida acá también para no gastar un viaje. */
const MIN_PASSWORD_LENGTH = 10;

function SignupForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const requestedPath = searchParams.get("from");
  const onboardingPath = requestedPath
    ? `/onboarding?from=${encodeURIComponent(safeReturnPath(requestedPath))}`
    : "/onboarding";

  // Solo se avisa cuando ya escribió algo en la confirmación: marcar en rojo
  // desde la primera tecla es acusar a alguien de un error que todavía está
  // cometiendo.
  const mismatch = confirmation.length > 0 && confirmation !== password;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
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
    <>
      <GoogleSignInButton
        onCredential={handleGoogleCredential}
        disabled={isPending}
      />

      <AuthDivider>o con tu correo</AuthDivider>

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
          <PasswordInput
            id="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isPending}
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            Al menos {MIN_PASSWORD_LENGTH} caracteres.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmation">Repetir contraseña</Label>
          <PasswordInput
            id="confirmation"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
            disabled={isPending}
            aria-invalid={mismatch}
            revealLabel="confirmación"
          />
          {mismatch && (
            <p className="text-xs text-destructive">
              Todavía no coincide con la anterior.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>
    </>
  );
}

export default function SignupPage() {
  return (
    <AuthShell
      title="Crear cuenta"
      intro="Después elegís si la usás para una empresa o de forma personal."
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Ingresá
          </Link>
        </>
      }
    >
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}
      >
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
