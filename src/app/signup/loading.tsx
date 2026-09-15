/**
 * Estado de carga propio de esta ruta.
 *
 * Sin esto Next usa el de `src/app/loading.tsx`, que arma el marco del
 * dashboard —barra lateral y encabezado—. Al navegar entre acceso y alta se
 * veía el tablero completo por un instante, con sesión o sin ella.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col justify-center bg-background px-6 py-12">
      <div
        className="mx-auto w-full max-w-sm space-y-8"
        aria-label="Cargando"
        aria-busy="true"
      >
        <Skeleton className="h-4 w-28" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </main>
  );
}
