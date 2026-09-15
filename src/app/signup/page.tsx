"use client";

/**
 * Alta propia, con verificación del correo.
 *
 * El alta la hace Firebase, que manda el correo de verificación. La cuenta no
 * entra a la app hasta que el enlace se abre: sin esa prueba, cualquiera podría
 * registrar un correo ajeno.
 *
 * Por eso esta pantalla NO deja una sesión abierta al terminar. Termina
 * diciendo que revise la casilla, que es un final honesto aunque sea menos
 * inmediato que entrar de una.
 *
 * Pide la contraseña dos veces porque es la única de las dos pantallas donde
 * un error de tipeo queda grabado.
 */

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthShell, AuthDivider } from "@/components/auth-shell";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { apiLoginGoogle } from "@/lib/api";
import { firebaseAuth, mensajeDeError } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { homePathFor, safeReturnPath } from "@/lib/auth-types";

/**
 * Firebase acepta desde 6. Diez es decisión nuestra: la cuenta da acceso a
 * datos operativos y el costo de escribir cuatro caracteres más se paga una
 * sola vez.
 */
const MIN_PASSWORD_LENGTH = 10;

function SignupForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
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
        const auth = firebaseAuth();
        const credencial = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        await sendEmailVerification(credencial.user);
        // Se cierra la sesión de Firebase a propósito: la cuenta existe pero
        // todavía no probó el correo, y dejarla abierta invita a intentar
        // entrar y chocar con un rechazo que no se entiende.
        await signOut(auth);
        setEnviado(true);
      } catch (cause) {
        setError(mensajeDeError(cause));
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

  if (enviado) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-border p-4">
          <MailCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">Te mandamos un correo</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Abrí el enlace que enviamos a{" "}
              <span className="font-medium text-foreground">{email}</span> para
              activar la cuenta. Después vas a poder ingresar.
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Si no aparece en unos minutos, revisá el correo no deseado.
        </p>

        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Ir a ingresar
        </Link>
      </div>
    );
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
