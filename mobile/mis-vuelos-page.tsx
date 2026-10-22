"use client";

import * as React from "react";

import { AppShell } from "@/components/app-shell";
import { MisVuelosView } from "@/components/viajero/mis-vuelos-view";
import { api, type SavedFlight } from "@/lib/api";

/**
 * Mis vuelos en el bundle empaquetado.
 *
 * La página de la web (`src/app/mis-vuelos/page.tsx`) es un Server Component
 * que pide los guardados durante el render. En un export estático ese render
 * ocurre una sola vez, en build time y sin usuario: el fetch falla y la página
 * quedaría horneada para siempre con "No pudimos traer tus vuelos". Así salió
 * el primer intento de bundle del rediseño, y por eso `build-mobile.mjs` ahora
 * busca ese texto en el HTML generado.
 *
 * Acá se piden al montar, con el token del usuario. La vista se monta recién
 * cuando hay respuesta: `MisVuelosView` toma `iniciales` como estado inicial y
 * no vuelve a mirarlo, así que montarla antes, con la lista vacía, diría
 * "todavía no guardaste ninguno" y no se enteraría de los datos.
 */
export default function MisVuelosPage() {
  const [state, setState] = React.useState<{
    vuelos: SavedFlight[];
    fallo: boolean;
    cargando: boolean;
  }>({ vuelos: [], fallo: false, cargando: true });

  React.useEffect(() => {
    let alive = true;
    api.savedFlights().then(
      (vuelos) => alive && setState({ vuelos, fallo: false, cargando: false }),
      (error) => {
        console.error("[mis-vuelos] no se pudieron cargar los guardados:", error);
        if (alive) setState({ vuelos: [], fallo: true, cargando: false });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <AppShell title="Mis vuelos">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mis vuelos</h1>
          <p className="text-sm text-muted-foreground">
            Los vuelos que guardaste. Quedan acá aunque ya hayan volado.
          </p>
        </header>
        {state.cargando ? (
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        ) : (
          <MisVuelosView iniciales={state.vuelos} fallo={state.fallo} />
        )}
      </div>
    </AppShell>
  );
}
