import { AppShell } from "@/components/app-shell";
import { MisVuelosView } from "@/components/viajero/mis-vuelos-view";
import { api, type SavedFlight } from "@/lib/api";

/**
 * Los vuelos guardados, o el aviso de que no se pudieron traer.
 *
 * Se distingue una cosa de la otra a proposito. Antes cualquier fallo -un 401,
 * un timeout, el backend caido- devolvia lista vacia, y la pantalla decia
 * "Todavia no guardaste ningun vuelo": una mentira tranquilizadora que ademas
 * hacia imposible diagnosticar nada desde afuera.
 *
 * El error se loguea para que quede en los logs del servicio, porque este
 * fetch corre en el servidor y no aparece en la pestaña de red del navegador.
 */
async function cargar(): Promise<{ vuelos: SavedFlight[]; fallo: boolean }> {
  try {
    return { vuelos: await api.savedFlights(), fallo: false };
  } catch (error) {
    console.error("[mis-vuelos] no se pudieron cargar los guardados:", error);
    return { vuelos: [], fallo: true };
  }
}

export default async function MisVuelosPage() {
  const { vuelos, fallo } = await cargar();
  return (
    <AppShell title="Mis vuelos">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mis vuelos</h1>
          <p className="text-sm text-muted-foreground">
            Los vuelos que guardaste. Quedan acá aunque ya hayan volado.
          </p>
        </header>
        <MisVuelosView iniciales={vuelos} fallo={fallo} />
      </div>
    </AppShell>
  );
}
