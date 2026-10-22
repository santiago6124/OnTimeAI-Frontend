"use client";

import * as React from "react";

import { AnticipacionView } from "@/components/tesis/anticipacion-view";
import { api, type LeadTime } from "@/lib/api";

/**
 * Anticipación frente a la aerolínea en el bundle empaquetado.
 *
 * Misma vista que la web; la métrica se pide al montar en vez de en el
 * servidor (ver `mobile/verificacion-page.tsx`). Sin esto el export congelaba
 * en build time lo que el backend contestara en ese momento, o su error.
 *
 * `metadata` no viaja: es una API de Server Components. El título lo pone
 * `AppShell` con `document.title`, como en el resto del bundle.
 */
export default function AnticipacionPage() {
  const [state, setState] = React.useState<{
    datos: LeadTime | null;
    fetchError: boolean;
    cargando: boolean;
  }>({ datos: null, fetchError: false, cargando: true });

  React.useEffect(() => {
    let alive = true;
    api.leadTime().then(
      (datos) => alive && setState({ datos, fetchError: false, cargando: false }),
      () => alive && setState({ datos: null, fetchError: true, cargando: false }),
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <AnticipacionView
      datos={state.datos}
      fetchError={state.fetchError}
      cargando={state.cargando}
    />
  );
}
