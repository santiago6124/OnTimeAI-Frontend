"use client";

/**
 * Buscar mi vuelo por número.
 *
 * No filtra la lista de abajo: busca *un* vuelo y lleva a su detalle. Un
 * viajero no explora 769 vuelos, llega sabiendo cuál le importa y lo escribe.
 *
 * El modo operaciones ya tiene el filtro sobre la tabla; ésta es la otra cosa.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plane, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtTime, type Flight } from "@/lib/api";
import { RiskBadge } from "@/components/risk-badge";

/** `DL 1234`, `dl1234`, `DAL1234` → `DL1234`. */
function normalizar(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Compara dos números de vuelo tolerando la forma en que cada fuente los
 * escribe: la aerolínea puede venir en IATA (DL) o ICAO (DAL), y el número
 * con ceros adelante. Lo que el viajero tipea sale de su tarjeta de embarque,
 * no de nuestra base.
 */
function coincide(consulta: string, vuelo: Flight): boolean {
  const q = normalizar(consulta);
  if (!q) return false;
  const candidatos = [
    vuelo.flight_number,
    `${vuelo.airline_code ?? ""}${vuelo.flight_number ?? ""}`,
  ]
    .filter(Boolean)
    .map((c) => normalizar(String(c)));

  const soloDigitos = q.replace(/^[A-Z]+/, "");
  return candidatos.some((c) => {
    if (c === q) return true;
    // Sin la aerolínea: "1234" encuentra DL1234 si no hay ambigüedad.
    const cDigitos = c.replace(/^[A-Z]+/, "");
    return cDigitos !== "" && cDigitos === soloDigitos.replace(/^0+/, "");
  });
}

export function BuscadorVuelo({ vuelos }: { vuelos: Flight[] }) {
  const router = useRouter();
  const [consulta, setConsulta] = React.useState("");

  const resultados = React.useMemo(() => {
    const q = normalizar(consulta);
    if (q.length < 2) return [];
    return vuelos.filter((v) => coincide(q, v)).slice(0, 6);
  }, [consulta, vuelos]);

  const sinResultados = normalizar(consulta).length >= 2 && resultados.length === 0;

  function abrir(id: string) {
    router.push(`/flights/${encodeURIComponent(id)}`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (resultados.length > 0) abrir(resultados[0].fa_flight_id);
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscá tu vuelo — por ejemplo DL1234"
          aria-label="Número de vuelo"
          autoComplete="off"
          className="h-14 rounded-full pl-12 pr-28 text-base shadow-sm"
        />
        <Button
          type="submit"
          disabled={resultados.length === 0}
          className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-full px-5"
        >
          Buscar
        </Button>
      </form>

      {resultados.length > 0 ? (
        <ul className="mt-3 overflow-hidden rounded-xl border bg-card shadow-sm">
          {resultados.map((v) => (
            <li key={v.fa_flight_id}>
              <button
                type="button"
                onClick={() => abrir(v.fa_flight_id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  "hover:bg-accent/60",
                )}
              >
                <Plane className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-mono text-sm font-semibold">
                  {v.flight_number}
                </span>
                <span className="text-sm text-muted-foreground">
                  {v.origin} → {v.destination}
                </span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {fmtTime(v.scheduled_out_utc)}
                </span>
                <RiskBadge risk={v.risk} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {sinResultados ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          No encontramos ese vuelo entre los de hoy en Atlanta.
        </p>
      ) : null}
    </div>
  );
}
