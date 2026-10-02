import { AppShell } from "@/components/app-shell";
import { AlertasClimaView } from "@/components/viajero/alertas-clima-view";
import { api, type WeatherAlert } from "@/lib/api";

async function cargar(): Promise<WeatherAlert[]> {
  try {
    return await api.weatherAlerts("high");
  } catch {
    return [];
  }
}

export default async function AlertasPage() {
  const alertas = await cargar();
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
        <AlertasClimaView iniciales={alertas} />
      </div>
    </AppShell>
  );
}
