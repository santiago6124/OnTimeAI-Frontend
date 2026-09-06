"use client";

import { AppShell } from "@/components/app-shell";
import { MetricCards } from "@/components/metric-cards";
import { FlightsTable } from "@/components/flights-table";
import { WeatherCard } from "@/components/weather-card";
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
      <div className="space-y-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Vuelos del día
          </h1>
          <p className="text-sm text-muted-foreground">
            Predicción en tiempo real de retrasos
          </p>
        </header>

        <MetricCards />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HourlyDelayChart />
          </div>
          <div className="flex flex-col gap-4">
            {(role === "admin" || role === "superadmin") && <ModelBadge />}
            <WeatherCard />
          </div>
        </div>

        <FlightsTable />
      </div>
    </AppShell>
  );
}
