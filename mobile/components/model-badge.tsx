"use client";

import * as React from "react";

import { api, type ModelInfo } from "@/lib/api";
import { ModelBadgeView } from "@/components/model-badge-view";

/**
 * Tarjeta del modelo activo en el bundle empaquetado. Ver
 * `mobile/components/metric-cards.tsx` para el porqué del fetch en el cliente.
 */
export function ModelBadge() {
  const [info, setInfo] = React.useState<ModelInfo | null>(null);

  React.useEffect(() => {
    let alive = true;
    api.model().then(
      (data) => alive && setInfo(data),
      () => alive && setInfo(null),
    );
    return () => {
      alive = false;
    };
  }, []);

  // Sin estado de carga aparte: la vista con `null` ya muestra la tarjeta con
  // guiones, que es exactamente lo que se ve mientras llega la respuesta.
  return <ModelBadgeView info={info} />;
}
