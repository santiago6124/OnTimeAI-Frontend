"use client";

import * as React from "react";

import { api, type MetricsSummary } from "@/lib/api";
import {
  MetricCardsSkeleton,
  MetricCardsView,
} from "@/components/metric-cards-view";

export { MetricCardsSkeleton };

/**
 * Tarjetas de métricas en el bundle empaquetado.
 *
 * La web las trae en un Server Component durante el render. Acá no hay servidor
 * y hacer el fetch en build time sería peor que no tenerlas: el .ipa quedaría
 * con las métricas del día en que se compiló, congeladas hasta la próxima
 * release. Se piden al montar.
 *
 * El dibujo es `MetricCardsView`, el mismo archivo que usa la web.
 */
export function MetricCards() {
  const [state, setState] = React.useState<{
    loading: boolean;
    data: MetricsSummary | null;
  }>({ loading: true, data: null });

  React.useEffect(() => {
    let alive = true;
    api.summary().then(
      (data) => alive && setState({ loading: false, data }),
      // `MetricCardsView` ya dibuja el estado "sin datos" con `null`, que es la
      // misma pantalla que muestra la web cuando el backend no responde.
      () => alive && setState({ loading: false, data: null }),
    );
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) return <MetricCardsSkeleton />;
  return <MetricCardsView data={state.data} />;
}
