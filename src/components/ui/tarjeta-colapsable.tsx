"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonColapsar } from "@/components/ui/seccion-colapsable";
import { useSeccionAbierta } from "@/lib/secciones-abiertas";
import { cn } from "@/lib/utils";

/**
 * Una tarjeta con dos versiones del MISMO contenido: compacta y detallada.
 *
 * No esconde nada al cerrar. Ésa fue la primera versión y estaba mal: cerrada
 * mostraba sólo el título y un resumen de una línea, y lo que se pedía era que
 * la sección siguiera mostrando su información, apretada. Cerrar para ocultar
 * ahorra espacio tirando el contenido; acá se ahorra apretándolo.
 *
 * Las dos versiones llegan ya renderizadas: `flight-detail-view` es Server
 * Component, así que no puede decidir cuál armar según un estado de cliente.
 * Se arman las dos en el servidor y acá se elige. El costo es render de más en
 * el servidor, no una consulta de más.
 */
export function TarjetaColapsable({
  clave,
  titulo,
  compacto,
  detallado,
  detalladoPorDefecto = false,
  className,
}: {
  /** Identifica la sección para recordar si quedó expandida. Estable: si
   *  cambia, el usuario pierde lo que había elegido. */
  clave: string;
  titulo: React.ReactNode;
  /** Toda la información, en su forma más apretada. */
  compacto: React.ReactNode;
  /** Lo mismo, con las etiquetas y el aire completos. */
  detallado: React.ReactNode;
  detalladoPorDefecto?: boolean;
  className?: string;
}) {
  const { abierto, alternar } = useSeccionAbierta(clave, detalladoPorDefecto);
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <BotonColapsar
          abierto={abierto}
          onToggle={alternar}
          titulo={
            <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
          }
        />
      </CardHeader>
      <CardContent className={cn(abierto ? "space-y-4" : "pb-4")}>
        {abierto ? detallado : compacto}
      </CardContent>
    </Card>
  );
}
