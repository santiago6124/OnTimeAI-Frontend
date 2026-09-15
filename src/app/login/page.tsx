"use client";

/**
 * Acceso con cuenta existente.
 *
 * La composición anterior apilaba insignia, nombre, bajada y encabezado de
 * tarjeta antes del primer campo: cuatro bloques centrados donde el nombre del
 * producto y el título de la pantalla competían por el mismo lugar. Ahora hay
 * un solo título, y la marca queda arriba como contexto.
 *
 * Google va primero porque es el camino que la mayoría usa y el que no exige
 * recordar nada. El correo queda abajo, no escondido.
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
import { apiLogin, apiLoginGoogle } from "@/lib/api";
import { homePathFor, safeReturnPath } from "@/lib/auth-types";

function LoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const requestedPath = searchParams.get("from");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await apiLogin(username, password);
        window.location.replace(safeReturnPath(requestedPath));
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "No se pudo iniciar sesión.",
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
          const next = requestedPath
            ? `?from=${encodeURIComponent(safeReturnPath(requestedPath))}`
            : "";
          window.location.replace(`/onboarding${next}`);
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
            : "No se pudo iniciar sesión con Google.",
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
          <Label htmlFor="username">Correo o usuario</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isPending}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Ingresar"
      intro="Predicción de retrasos en Hartsfield-Jackson, recalculada cada quince minutos."
      footer={
        <>
          ¿No tenés cuenta?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Registrate
          </Link>
        </>
      }
    >
      <Suspense
        fallback={<div className="h-72 animate-pulse rounded-lg bg-muted" />}
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
