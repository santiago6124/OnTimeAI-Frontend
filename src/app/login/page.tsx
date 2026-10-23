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
 * recordar nada; en el binario de iOS, Apple va encima (guía 4.8 de App
 * Store). El correo queda abajo, no escondido.
 */

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthShell, AuthDivider } from "@/components/auth-shell";
import {
  useGoogleSignInDisponible,
  GoogleSignInButton,
} from "@/components/google-sign-in-button";
import {
  AppleSignInButton,
  useAppleSignInDisponible,
} from "@/components/apple-sign-in-button";
import { apiLoginFirebase } from "@/lib/api";
import { type SesionDeGoogle } from "@/lib/auth-google";
import { firebaseAuth, mensajeDeError } from "@/lib/firebase";
import { safeReturnPath } from "@/lib/auth-types";
import { IS_BUNDLED } from "@/lib/mobile-env";

function LoginForm() {
  const searchParams = useSearchParams();
  // Decide junto con el botón: si el separador "o con tu correo" quedara
  // dibujado sin el botón, anunciaría una alternativa que no está.
  const googleDisponible = useGoogleSignInDisponible();
  // Solo en el binario de iOS que trae el entitlement; ver apple-sign-in.ts.
  const appleDisponible = useAppleSignInDisponible();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  // Se guarda aparte del error porque habilita una acción —reenviar el correo—
  // y no solo un mensaje.
  const [sinVerificar, setSinVerificar] = useState(false);
  const [isPending, startTransition] = useTransition();

  const requestedPath = searchParams.get("from");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    setSinVerificar(false);
    startTransition(async () => {
      const auth = firebaseAuth();
      try {
        const credencial = await signInWithEmailAndPassword(
          auth,
          username.trim(),
          password,
        );

        if (!credencial.user.emailVerified) {
          // La cuenta existe y la contraseña es correcta, pero el correo no
          // está probado. Se cierra la sesión de Firebase para no dejarla a
          // medias, y se ofrece reenviar el enlace.
          await signOut(auth);
          setSinVerificar(true);
          setError("Falta activar la cuenta desde el enlace que te mandamos.");
          return;
        }

        const token = await credencial.user.getIdToken();
        const session = await apiLoginFirebase(token);
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
            : "/",
        );
      } catch (cause) {
        setError(mensajeDeError(cause));
      }
    });
  }

  function reenviarVerificacion() {
    setError("");
    startTransition(async () => {
      const auth = firebaseAuth();
      try {
        const credencial = await signInWithEmailAndPassword(
          auth,
          username.trim(),
          password,
        );
        await sendEmailVerification(credencial.user);
        await signOut(auth);
        setSinVerificar(false);
        setAviso("Te reenviamos el correo. Revisá tu casilla.");
      } catch (cause) {
        setError(mensajeDeError(cause));
      }
    });
  }

  function recuperarContrasena() {
    setError("");
    setAviso("");
    if (!username.trim()) {
      setError("Escribí tu correo arriba y volvé a tocar acá.");
      return;
    }
    startTransition(async () => {
      try {
        await sendPasswordResetEmail(firebaseAuth(), username.trim());
        // Se confirma siempre, exista o no la cuenta: decir "ese correo no
        // está registrado" le revela a cualquiera qué correos tienen cuenta.
        setAviso("Si hay una cuenta con ese correo, te llega un enlace.");
      } catch (cause) {
        setError(mensajeDeError(cause));
      }
    });
  }

  // El canje del token lo hace el botón, que es el que sabe por qué camino
  // vino la credencial —Google Identity Services en la web, el plugin nativo en
  // el teléfono—. Acá solo queda a dónde mandar al usuario.
  function handleSesionExterna(session: SesionDeGoogle) {
    setError("");
    if (session.isNewUser) {
      const next = requestedPath
        ? `?from=${encodeURIComponent(safeReturnPath(requestedPath))}`
        : "";
      window.location.replace(`/onboarding${next}`);
      return;
    }
    window.location.replace(
      requestedPath ? safeReturnPath(requestedPath) : "/",
    );
  }

  return (
    <>
      {/* Apple arriba de Google: la guía 4.8 de App Store pide que no quede
          menos visible que otro login de terceros. Mismo tamaño, mismo handler:
          los dos devuelven la sesión ya canjeada en /auth/firebase. */}
      {appleDisponible && (
        <div className="mb-3">
          <AppleSignInButton
            onSession={handleSesionExterna}
            onError={setError}
            disabled={isPending}
          />
        </div>
      )}

      <GoogleSignInButton
        onSession={handleSesionExterna}
        onError={setError}
        disabled={isPending}
      />

      {(googleDisponible || appleDisponible) && (
        <AuthDivider>o con tu correo</AuthDivider>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="username">Correo</Label>
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
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">Contraseña</Label>
            <button
              type="button"
              onClick={recuperarContrasena}
              disabled={isPending}
              className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
            >
              La olvidé
            </button>
          </div>
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
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            {sinVerificar && (
              <button
                type="button"
                onClick={reenviarVerificacion}
                disabled={isPending}
                className="text-sm font-medium underline underline-offset-4 disabled:opacity-50"
              >
                Reenviar el correo de activación
              </button>
            )}
          </div>
        )}

        {aviso && (
          <p role="status" className="text-sm text-muted-foreground">
            {aviso}
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
      // En el bundle de iOS no se ofrece el alta. Guideline 5.1.1(v): una app
      // que permite crear cuenta tiene que permitir borrarla desde adentro, y
      // ese flujo todavía no existe. La cuenta se crea en la web, con el
      // mismo correo, y entra acá igual.
      footer={
        IS_BUNDLED ? undefined : (
          <>
            ¿No tenés cuenta?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Registrate
            </Link>
          </>
        )
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
