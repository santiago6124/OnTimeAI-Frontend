/**
 * Estado de carga propio de esta ruta.
 *
 * Sin esto Next usa el de `src/app/loading.tsx`, que arma el marco del
 * dashboard —barra lateral y encabezado—. Llegando desde el alta se veía
 * asomar ese marco detrás de esta pantalla, que no lo usa.
 *
 * Es el mismo arreglo que ya tienen /login y /signup; a esta ruta se le pasó
 * por alto porque se llega a ella una sola vez por cuenta.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div
        className="w-full max-w-xl space-y-6"
        aria-label="Cargando"
        aria-busy="true"
      >
        <div className="flex flex-col items-center">
          <Skeleton className="size-12 rounded-lg" />
          <Skeleton className="mt-8 h-7 w-64" />
          <Skeleton className="mt-1.5 h-4 w-72" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}
