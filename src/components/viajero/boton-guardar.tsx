"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

/**
 * Guardar o soltar un vuelo desde su pantalla de detalle.
 *
 * El estado se adelanta al servidor y se revierte si la llamada falla: el
 * viajero toca una vez y ve el cambio, no una ruedita.
 */
export function BotonGuardar({
  faFlightId,
  guardadoInicial,
}: {
  faFlightId: string;
  guardadoInicial: boolean;
}) {
  const [guardado, setGuardado] = React.useState(guardadoInicial);
  const [enVuelo, setEnVuelo] = React.useState(false);

  async function alternar() {
    const previo = guardado;
    setGuardado(!previo);
    setEnVuelo(true);
    try {
      if (previo) await api.unsaveFlight(faFlightId);
      else await api.saveFlight(faFlightId);
    } catch {
      setGuardado(previo);
    } finally {
      setEnVuelo(false);
    }
  }

  const Icono = guardado ? BookmarkCheck : Bookmark;
  return (
    <Button
      variant={guardado ? "secondary" : "outline"}
      onClick={alternar}
      disabled={enVuelo}
      aria-pressed={guardado}
      className="gap-2"
    >
      <Icono className="size-4" />
      {guardado ? "Guardado" : "Guardar"}
    </Button>
  );
}
