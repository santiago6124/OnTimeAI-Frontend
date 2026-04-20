import { AppShell } from "@/components/app-shell";
import { RoutesTable } from "@/components/routes-table";

export default function RoutesPage() {
  return (
    <AppShell title="Historial por ruta">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Puntualidad histórica por ruta
          </h1>
          <p className="text-sm text-muted-foreground">
            Desempeño agregado de las rutas desde y hacia ATL.
          </p>
        </header>
        <RoutesTable />
      </div>
    </AppShell>
  );
}
