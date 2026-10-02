import { AppShell } from "@/components/app-shell";
import { MisVuelosView } from "@/components/viajero/mis-vuelos-view";
import { api, type SavedFlight } from "@/lib/api";

async function cargar(): Promise<SavedFlight[]> {
  try {
    return await api.savedFlights();
  } catch {
    return [];
  }
}

export default async function MisVuelosPage() {
  const vuelos = await cargar();
  return (
    <AppShell title="Mis vuelos">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mis vuelos</h1>
          <p className="text-sm text-muted-foreground">
            Los vuelos que guardaste. Quedan acá aunque ya hayan volado.
          </p>
        </header>
        <MisVuelosView iniciales={vuelos} />
      </div>
    </AppShell>
  );
}
