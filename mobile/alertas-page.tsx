"use client";

import * as React from "react";

import { AppShell } from "@/components/app-shell";
import { AlertasClimaView } from "@/components/viajero/alertas-clima-view";
import { api, type WeatherAlert } from "@/lib/api";

/**
 * Alertas meteorológicas en el bundle empaquetado.
 *
 * La web (`src/app/alertas/page.tsx`) pide las alertas graves en el servidor
 * durante el render; en un export estático eso corre una sola vez, en build
 * time, y la lista quedaría congelada en el clima de ese momento. Acá se piden
 * al montar. Igual que en `mis-vuelos-page.tsx`, la vista se monta cuando hay
 * respuesta, porque toma `iniciales` como estado inicial una sola vez.
 *
 * La web convierte un fallo en lista vacía. En el teléfono un fallo es casi
 * siempre falta de red, y "sin alertas" sería una mentira tranquilizadora: se
 * dice y se ofrece reintentar.
 */
export default function AlertasPage() {
  const [state, setState] = React.useState<{
    alertas: WeatherAlert[];
    fallo: boolean;
    cargando: boolean;
  }>({ alertas: [], fallo: false, cargando: true });

  React.useEffect(() => {
    let alive = true;
    api.weatherAlerts("high").then(
      (alertas) => alive && setState({ alertas, fallo: false, cargando: false }),
      () => alive && setState({ alertas: [], fallo: true, cargando: false }),
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <AppShell title="Alertas meteorológicas">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Alertas meteorológicas
          </h1>
          <p className="text-sm text-muted-foreground">
            Aeropuertos con mal tiempo ahora mismo, del más grave al menos.
          </p>
        </header>
        {state.cargando ? (
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        ) : state.fallo ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            No pudimos traer las alertas.{" "}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-medium underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <AlertasClimaView iniciales={state.alertas} />
        )}
      </div>
    </AppShell>
  );
}
