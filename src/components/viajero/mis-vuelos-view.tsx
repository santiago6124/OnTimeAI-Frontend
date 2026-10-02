"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, Bookmark, Plane, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { api, fmtTime, type SavedFlight } from "@/lib/api";

/**
 * Los vuelos guardados, del más próximo al más viejo.
 *
 * La lista mezcla dos clases de fila y eso es a propósito. Un vuelo guardado
 * hace tres semanas ya no existe en `live_data.db` —el pipeline purga a los
 * 14 días— así que vuelve del backend marcado como `archived`, con la copia
 * de su número y su ruta pero sin predicción. Se muestra igual, apagado: el
 * pedido es que los guardados queden históricamente, y una lista que borra
 * sola lo viejo no cumple eso.
 */
export function MisVuelosView({ iniciales }: { iniciales: SavedFlight[] }) {
  const [vuelos, setVuelos] = React.useState(iniciales);
  const [quitando, setQuitando] = React.useState<string | null>(null);

  async function quitar(id: string) {
    setQuitando(id);
    const previos = vuelos;
    setVuelos((v) => v.filter((x) => x.fa_flight_id !== id));
    try {
      await api.unsaveFlight(id);
    } catch {
      setVuelos(previos); // si falla, la fila vuelve
    } finally {
      setQuitando(null);
    }
  }

  if (vuelos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <Bookmark className="size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">Todavía no guardaste ningún vuelo</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Buscá tu vuelo desde el inicio y tocá «Guardar». Van a quedar acá,
            incluso después de que hayan volado.
          </p>
          <Button
            variant="outline"
            className="mt-1"
            render={<Link href="/" />}
          >
            Buscar un vuelo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activos = vuelos.filter((v) => !v.archived);
  const archivados = vuelos.filter((v) => v.archived);

  return (
    <div className="space-y-6">
      {activos.length > 0 ? (
        <Seccion titulo="En seguimiento">
          {activos.map((v) => (
            <Fila
              key={v.fa_flight_id}
              vuelo={v}
              quitando={quitando === v.fa_flight_id}
              onQuitar={quitar}
            />
          ))}
        </Seccion>
      ) : null}

      {archivados.length > 0 ? (
        <Seccion
          titulo="Ya volaron"
          nota="Guardamos el vuelo, pero su predicción ya salió del sistema."
        >
          {archivados.map((v) => (
            <Fila
              key={v.fa_flight_id}
              vuelo={v}
              quitando={quitando === v.fa_flight_id}
              onQuitar={quitar}
            />
          ))}
        </Seccion>
      ) : null}
    </div>
  );
}

function Seccion({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">{titulo}</h2>
        {nota ? <p className="text-xs text-muted-foreground/80">{nota}</p> : null}
      </div>
      <Card>
        <CardContent className="px-0 py-0">
          <ul className="divide-y">{children}</ul>
        </CardContent>
      </Card>
    </section>
  );
}

function Fila({
  vuelo,
  quitando,
  onQuitar,
}: {
  vuelo: SavedFlight;
  quitando: boolean;
  onQuitar: (id: string) => void;
}) {
  const numero = vuelo.flight_number ?? vuelo.ident_iata ?? vuelo.fa_flight_id;
  const destino = vuelo.destination ?? vuelo.dest ?? "—";
  const Icono = vuelo.archived ? Archive : Plane;

  return (
    <li className="flex items-center gap-3 px-6 py-3">
      <Icono className="size-4 shrink-0 text-muted-foreground" />
      <Link
        href={`/flights/${encodeURIComponent(vuelo.fa_flight_id)}`}
        className="min-w-0 flex-1"
      >
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold">{numero}</span>
          <span className="truncate text-sm text-muted-foreground">
            hacia {destino}
          </span>
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {vuelo.scheduled_out_utc ? `${fmtTime(vuelo.scheduled_out_utc)} UTC` : "—"}
        </div>
      </Link>

      {vuelo.risk ? (
        <RiskBadge risk={vuelo.risk} />
      ) : (
        <span className="text-xs text-muted-foreground">sin predicción</span>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onQuitar(vuelo.fa_flight_id)}
        disabled={quitando}
        aria-label={`Quitar ${numero} de mis vuelos`}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
