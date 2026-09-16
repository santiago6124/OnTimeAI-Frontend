"use client";

/**
 * Elección de perfil, lo primero que ve una cuenta recién creada.
 *
 * Antes eran dos tarjetas quietas: no respondían al mouse ni al clic, así que
 * no se leían como algo que se pueda apretar. Ahora cada opción es un botón, y
 * el clic tiene su momento: el avión se alinea en la pista, se agacha y
 * despega. Dura lo que dura la llamada al backend, así que no agrega espera.
 *
 * La metáfora sale del proyecto y no de un efecto cualquiera; es la única
 * pantalla que se ve una vez por cuenta, y vale que se note.
 */

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, LayoutDashboard, Plane } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
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

/** Lo que tarda el despegue en verse entero. */
const DESPEGUE_MS = 700;

/**
 * Quien pidió menos movimiento no ve la animación, así que esperarla sería
 * una pausa muerta frente a una pantalla que no cambia.
 */
function quiereMenosMovimiento() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function ProfilePicker() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [despegando, setDespegando] = useState<UserType | null>(null);
  const [isPending, startTransition] = useTransition();

  const requestedPath = searchParams.get("from");

  function choose(userType: UserType) {
    setError("");
    setDespegando(userType);
    startTransition(async () => {
      try {
        // En paralelo y no en serie: la animación corre mientras el backend
        // responde, así que el despegue no le suma tiempo a nadie.
        await Promise.all([
          apiSetUserType(userType),
          quiereMenosMovimiento()
            ? Promise.resolve()
            : new Promise((listo) => setTimeout(listo, DESPEGUE_MS)),
        ]);
        window.location.replace(
          requestedPath ? safeReturnPath(requestedPath) : homePathFor(userType),
        );
      } catch (cause) {
        setDespegando(null);
        setError(
          cause instanceof Error ? cause.message : "No se pudo guardar el perfil.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {PROFILES.map(({ value, title, description, icon: Icon }) => {
          const despega = despegando === value;
          // Mientras uno despega, el otro se aparta en vez de quedar compitiendo
          // por la atención con la opción que ya se eligió.
          const relegado = despegando !== null && !despega;

          return (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              disabled={isPending}
              aria-busy={despega}
              className={[
                "group relative flex flex-col items-start gap-3 overflow-hidden",
                "rounded-xl bg-card p-5 text-left ring-1 ring-foreground/10",
                "transition-all duration-300 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                // El estado de reposo tiene que verse apretable: se levanta, el
                // anillo toma color y aparece sombra.
                "hover:-translate-y-1 hover:bg-accent/30 hover:ring-primary/50",
                "hover:shadow-lg hover:shadow-primary/10",
                "active:translate-y-0 active:scale-[0.98] active:duration-75",
                "disabled:cursor-default",
                despega ? "ring-2 ring-primary shadow-lg shadow-primary/20" : "",
                relegado ? "scale-[0.97] opacity-40" : "",
              ].join(" ")}
            >
              {/* Barrido de luz, solo en el que despega. */}
              {despega && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-primary/25 to-transparent animate-[ontime-barrido_700ms_ease-out_forwards]"
                />
              )}

              <span
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  "bg-primary/10 transition-colors duration-300",
                  "group-hover:bg-primary/20",
                  despega ? "bg-primary/20" : "",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "h-5 w-5 text-primary transition-transform duration-300 ease-out",
                    // Al pasar el mouse el avión se alinea; al elegir, despega.
                    despega
                      ? "animate-[ontime-despegue_700ms_cubic-bezier(0.4,0,0.2,1)_forwards]"
                      : "group-hover:-translate-y-0.5 group-hover:-rotate-12",
                  ].join(" ")}
                />
              </span>

              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-base font-semibold">{title}</span>
                {/* Señal de que esto lleva a algún lado, no solo de que se puede tocar. */}
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-primary opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </span>

              <span className="text-sm text-muted-foreground">{description}</span>

              {/* La pista. Sus marcas corren hacia el avión mientras el mouse
                  está encima, y se encienden del todo al despegar. */}
              <span
                aria-hidden="true"
                className={[
                  "ontime-pista mt-1 h-0.5 w-full transition-colors duration-300",
                  despega
                    ? "text-primary animate-[ontime-pista_300ms_linear_infinite]"
                    : "text-primary/25 group-hover:text-primary/60 group-hover:animate-[ontime-pista_600ms_linear_infinite]",
                ].join(" ")}
              />
            </button>
          );
        })}
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
        <div className="flex flex-col items-center text-center">
          <BrandMark showName={false} />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">
            ¿Cómo vas a usar OnTimeAI?
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
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
