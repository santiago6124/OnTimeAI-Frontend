"use client";

import * as React from "react";

import { api } from "@/lib/api";
import {
  computeOperationalImpact,
  type OperationalImpact,
} from "@/lib/operational-impact";
import {
  OperationalImpactCardsView,
  OperationalImpactSkeleton,
} from "@/components/operational-impact-cards-view";

export { OperationalImpactSkeleton };

/**
 * Impacto operacional en el bundle empaquetado. Ver
 * `mobile/components/metric-cards.tsx` para el porqué del fetch en el cliente.
 *
 * Acá pesa más que en las otras tarjetas: el cálculo toma `Date.now()` como
 * instante de referencia para decidir qué vuelos entran en la ventana de
 * acción. Resuelto en build time, un .ipa mostraría la ventana del día en que
 * se compiló — no vacía, sino con números plausibles y equivocados.
 */
export function OperationalImpactCards() {
  const [state, setState] = React.useState<{
    loading: boolean;
    impact: OperationalImpact | null;
  }>({ loading: true, impact: null });

  React.useEffect(() => {
    let alive = true;
    api.flights().then(
      (flights) =>
        alive &&
        setState({
          loading: false,
          impact: computeOperationalImpact(flights, Date.now()),
        }),
      () => alive && setState({ loading: false, impact: null }),
    );
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) return <OperationalImpactSkeleton />;
  return <OperationalImpactCardsView impact={state.impact} />;
}
