import { AppShell } from "@/components/app-shell";
import { FlightsTable } from "@/components/flights-table";

export default function FlightsPage() {
  return (
    <AppShell title="Vuelos ATL">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Buscador de vuelos
          </h1>
          <p className="text-sm text-muted-foreground">
            Filtrá por vuelo, aerolínea, destino o nivel de riesgo.
          </p>
        </header>
        <FlightsTable />
      </div>
    </AppShell>
  );
}
