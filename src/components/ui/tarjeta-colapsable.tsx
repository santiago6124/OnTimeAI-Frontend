"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BotonColapsar,
  CuerpoColapsable,
  useColapsable,
} from "@/components/ui/seccion-colapsable";
import { cn } from "@/lib/utils";

/**
 * Una tarjeta cuyo cuerpo colapsa.
 *
 * Existe para que `flight-detail-view`, que es Server Component, pueda tener
 * secciones que abren y cierran: el contenido se arma en el servidor y llega
 * acá como children.
 *
 * `resumen` es lo que la sección dice cuando está cerrada. No es opcional en
 * la práctica: una sección cerrada sin resumen esconde información en vez de
 * ahorrar espacio, que es lo contrario de lo que se busca.
 */
export function TarjetaColapsable({
  titulo,
  resumen,
  children,
  abiertaPorDefecto = false,
  className,
}: {
  titulo: React.ReactNode;
  resumen?: React.ReactNode;
  children: React.ReactNode;
  abiertaPorDefecto?: boolean;
  className?: string;
}) {
  const { abierto, alternar } = useColapsable(abiertaPorDefecto);
  return (
    <Card className={className}>
      <CardHeader className={cn("pb-2", !abierto && "pb-3")}>
        <BotonColapsar
          abierto={abierto}
          onToggle={alternar}
          titulo={
            <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
          }
          resumen={resumen}
        />
      </CardHeader>
      <CuerpoColapsable abierto={abierto}>
        <CardContent className="space-y-4">{children}</CardContent>
      </CuerpoColapsable>
    </Card>
  );
}
