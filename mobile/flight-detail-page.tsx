"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { useProfile } from "@/components/providers/profile-provider";
import { api, type Flight, type PredictionPoint } from "@/lib/api";
import { FlightDetailView } from "@/components/flight-detail-view";
import { DetalleViajero } from "@/components/viajero/detalle-viajero";

/**
 * Detalle de vuelo en el bundle empaquetado.
 *
 * En la web esta pantalla vive en `/flights/[id]`. Un export estático no puede
 * tener ese segmento sin resolver —`generateStaticParams` exige conocer los ids
 * en build time, y los `fa_flight_id` son datos vivos—, así que
 * `scripts/build-mobile.mjs` mueve la ruta a `/flights/detail` y el id viaja
 * como query param. Los enlaces los emite `flightDetailHref()`, que ya sabe
 * cuál de las dos formas corresponde a este build.
 *
 * Igual que la web, dibuja una de dos pantallas según el perfil: la de
 * operaciones (SHAP, historial, umbral) o la del viajero (veredicto, motivos
 * en castellano, botón de guardar). La web lo decide con `getServerProfile()`;
 * acá con `useProfile()`, ver `mobile/app-page.tsx`.
 */
function FlightDetail() {
  const id = useSearchParams().get("id");
  const { profile } = useProfile();
  const esViajero = profile === "passenger";

  const [state, setState] = React.useState<{
    status: "loading" | "ok" | "error";
    flight: Flight | null;
    history: PredictionPoint[];
    guardado: boolean;
    message: string;
  }>({
    status: "loading",
    flight: null,
    history: [],
    guardado: false,
    message: "",
  });

  React.useEffect(() => {
    // Sin id no hay nada que pedir. El caso se dibuja abajo, en el render, y no
    // seteando estado acá: un setState sincrónico en el cuerpo de un efecto
    // fuerza un segundo render para mostrar algo que ya se sabía al primero.
    if (!id) return;

    let alive = true;
    (async () => {
      try {
        // En serie y no en paralelo a propósito: si el vuelo no existe, no
        // tiene sentido haber pedido también lo demás.
        const flight = await api.flight(id);

        if (esViajero) {
          // Como en la web: si no se pudo saber si está guardado, se asume que
          // no. El botón lo corrige al primer toque.
          const guardado = await api
            .savedFlights()
            .then((lista) =>
              lista.some((v) => v.fa_flight_id === flight.fa_flight_id),
            )
            .catch(() => false);
          if (alive) {
            setState({ status: "ok", flight, history: [], guardado, message: "" });
          }
          return;
        }

        const history = await api.flightHistory(id);
        if (alive) {
          setState({ status: "ok", flight, history, guardado: false, message: "" });
        }
      } catch (error) {
        if (!alive) return;
        setState({
          status: "error",
          flight: null,
          history: [],
          guardado: false,
          message:
            error instanceof Error
              ? error.message
              : "No se pudo cargar el vuelo.",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, esViajero]);

  if (state.status === "ok" && state.flight) {
    return esViajero ? (
      <DetalleViajero flight={state.flight} guardado={state.guardado} />
    ) : (
      <FlightDetailView flight={state.flight} history={state.history} />
    );
  }

  const mensaje = !id ? "No se indicó qué vuelo mostrar." : state.message;
  const cargando = Boolean(id) && state.status === "loading";

  // La web resuelve esto con notFound() y el error boundary del servidor. Acá
  // el error se dibuja en el lugar, dentro del shell, para que el usuario
  // conserve la navegación y el botón de volver.
  return (
    <AppShell title="Detalle de vuelo">
      <div className="space-y-4">
        <BackButton />
        {cargando ? (
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
        ) : (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {mensaje}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/**
 * `useSearchParams()` obliga a un límite de Suspense: en el prerender de build
 * time los query params no existen todavía, y sin el límite Next falla el
 * export entero.
 */
export default function FlightDetailPage() {
  return (
    <React.Suspense
      fallback={
        <AppShell title="Detalle de vuelo">
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
        </AppShell>
      }
    >
      <FlightDetail />
    </React.Suspense>
  );
}
