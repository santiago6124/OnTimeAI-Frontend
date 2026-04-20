import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <AppShell title="Reportes">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            Consolidado de métricas operacionales para reporting interno.
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Próximamente</CardTitle>
            <CardDescription>
              Exportación de datos agregados a CSV/PDF y reportes diarios
              automatizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Este módulo se conectará a los endpoints de métricas del backend en
            FastAPI.
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
