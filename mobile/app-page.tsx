"use client";

import { AppShell } from "@/components/app-shell";
import { MetricCards } from "@/components/metric-cards";
import { OperationalImpactCards } from "@/components/operational-impact-cards";
import { FlightsTable } from "@/components/flights-table";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { ModelBadge } from "@/components/model-badge";
import { useSession } from "@/components/providers/session-provider";

/**
 * Dashboard del bundle empaquetado.
 *
 * Mismo layout que `src/app/page.tsx`; las dos diferencias vienen de que acá no
 * hay servidor:
 *
 *  - El rol sale de `useSession()` en vez de `getServerRole()`, que lee la
 *    cookie con `next/headers`. El valor es el mismo usuario: lo resolvió
 *    `NativeSessionGate` contra /auth/me antes de montar este árbol.
 *
 *  - No hay `<Suspense>`. En la web envuelve Server Components que hacen await
 *    durante el render y streamean; acá `MetricCards`, `WeatherCard` y
 *    `ModelBadge` son las variantes cliente, que traen sus datos al montar y
 *    dibujan su propio estado de carga.
 */
export default function DashboardPage() {
  const { user } = useSession();
  const role = user?.role ?? "user";

  return (
    <AppShell title="Dashboard operacional">
      <div className="space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Vuelos del día
          </h1>
          <p className="text-sm text-muted-foreground">
            Predicción en tiempo real de retrasos
          </p>
        </header>

        {/* Las tres tarjetas van en una sola grilla, y por eso las dos vistas
            devuelven fragmentos en vez de dibujar cada una la suya. Acá los
            componentes traen sus datos al montar, así que las tarjetas son
            hijas directas de la grilla sin más. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCards />
          <OperationalImpactCards />
        </div>

        {/* A todo el ancho: es lo único de la pantalla que se lee de un
            vistazo, y antes compartía la fila con el clima. */}
        <HourlyDelayChart />

        <FlightsTable />

        {/* Al final: es ficha técnica del modelo, no dato operativo. */}
        {(role === "admin" || role === "superadmin") && <ModelBadge />}
      </div>
    </AppShell>
  );
}
