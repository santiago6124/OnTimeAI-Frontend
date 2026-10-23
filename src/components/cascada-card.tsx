"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, GitBranch, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonColapsar } from "@/components/ui/seccion-colapsable";
import { useSeccionAbierta } from "@/lib/secciones-abiertas";
import { api, fmtTime, type Cascada } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Efecto cascada: a qué vuelos siguientes les llega la demora de este.
 *
 * Es la mitad del título de la tesis y uno de los objetivos del anteproyecto
 * —«visualizar el efecto cascada proyectado»—, así que la pantalla tiene que
 * sostener lo que el número vale y no más:
 *
 * 1. De dónde salen los minutos va a la vista, con etiqueta. Una demora medida
 *    de un vuelo que ya aterrizó y una derivada de la probabilidad del modelo
 *    no valen lo mismo, y la segunda viene con aviso del backend.
 * 2. "No sabemos" se distingue de "no hay cascada". Si no conocemos la
 *    rotación, la pantalla lo dice en vez de mostrar una lista vacía, que se
 *    leería como que la demora no se propaga.
 * 3. Es una proyección con 18 minutos de error absoluto medio por paso. El
 *    número va con esa nota, no como una hora prometida.
 *
 * El simulador existe porque el anteproyecto lo pide: «dado un vuelo
 * retrasado, propagar el impacto». Permite preguntar qué pasaría con una
 * demora que todavía no ocurrió.
 */

/** Minutos de demora que ofrece el simulador. */
const ESCENARIOS = [30, 60, 120] as const;

export type EstadoCascada =
  | "cargando"
  | "error"
  | "sin_dato"
  | "no_propaga"
  | "lista";

/**
 * Cuál de los cinco estados mostrar.
 *
 * Está afuera del componente para poder probarlo: el repo no tiene
 * `testing-library` ni `jsdom`. La distinción que importa es `sin_dato` contra
 * `no_propaga`: la primera es "no conocemos la rotación de este avión" y la
 * segunda "la conocemos y la demora no alcanza para arrastrarla". Mostrar la
 * misma cosa en los dos casos haría leer un hueco de datos como un resultado
 * tranquilizador.
 */
export function estadoDeLaCascada(
  datos: Cascada | null,
  { cargando = false, error = false } = {},
): EstadoCascada {
  if (cargando) return "cargando";
  if (error || !datos) return "error";
  if (datos.motivo) return "sin_dato";
  return datos.piernas.length === 0 ? "no_propaga" : "lista";
}

const ETIQUETA_ORIGEN = {
  real: "demora medida",
  simulada: "simulación",
  estimada: "estimada del modelo",
} as const;

// eslint-disable-next-line complexity -- deuda registrada en .complejidad-baseline.json
export function CascadaCard({
  faFlightId,
  inicial,
}: {
  faFlightId: string;
  /** Lo que trajo el servidor, para que el primer render ya tenga datos. */
  inicial?: Cascada | null;
}) {
  const [datos, setDatos] = useState<Cascada | null>(inicial ?? null);
  const [simulada, setSimulada] = useState<number | null>(null);
  const [cargando, setCargando] = useState(inicial === undefined);
  const [error, setError] = useState(false);

  const traer = useCallback(
    async (demora: number | null) => {
      setCargando(true);
      setError(false);
      try {
        setDatos(await api.cascada(faFlightId, demora ?? undefined));
      } catch {
        // No se trata como "no hay cascada": son cosas distintas y la pantalla
        // lo dice.
        setError(true);
      } finally {
        setCargando(false);
      }
    },
    [faFlightId],
  );

  // La primera carga NO pasa por `traer`: ésa toca el estado de forma
  // sincrónica y dentro de un efecto eso es `set-state-in-effect`. Acá el
  // primer cambio ocurre después del `await`, y `cargando` ya arranca en true
  // desde el inicializador.
  useEffect(() => {
    if (inicial !== undefined) return;
    let vivo = true;
    (async () => {
      try {
        const d = await api.cascada(faFlightId);
        if (vivo) setDatos(d);
      } catch {
        if (vivo) setError(true);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [faFlightId, inicial]);

  const estado = estadoDeLaCascada(datos, { cargando, error });
  const piernas = datos?.piernas ?? [];
  const alcanzados = piernas.filter((p) => p.demorado).length;
  // Abierta por defecto: es la mitad del título de la tesis, y cerrada por
  // omisión volvería a quedar invisible como cuando estaba al pie.
  const { abierto, alternar } = useSeccionAbierta("efecto-cascada", true);

  // Lo que dice cerrada. Sin esto, cerrarla esconde el resultado en vez de
  // ahorrar espacio.
  const resumen =
    estado === "cargando"
      ? "calculando…"
      : estado === "lista"
        ? alcanzados === 0
          ? "no arrastra"
          : `${alcanzados} vuelo${alcanzados === 1 ? "" : "s"} afectado${alcanzados === 1 ? "" : "s"}`
        : estado === "no_propaga"
          ? "no arrastra"
          : estado === "sin_dato"
            ? "rotación desconocida"
            : "sin dato";

  return (
    <Card>
      <CardHeader className="pb-2">
        <BotonColapsar
          abierto={abierto}
          onToggle={alternar}
          resumen={resumen}
          titulo={
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <GitBranch className="size-4 text-muted-foreground" aria-hidden />
              Efecto cascada
              {datos?.demora_origen ? (
                <Badge variant="secondary" className="font-normal">
                  {ETIQUETA_ORIGEN[datos.demora_origen]}
                </Badge>
              ) : null}
            </CardTitle>
          }
        />
      </CardHeader>

      <CardContent className="space-y-4 pb-5">
        {/* El simulador va arriba: es lo que invita a usar la tarjeta. En
            compacto se oculta: es un control, no información, y ocupa una
            fila entera. */}
        <div className={cn("flex-wrap items-center gap-2", abierto ? "flex" : "hidden")}>
          <span className="text-xs text-muted-foreground">Simular llegada</span>
          {ESCENARIOS.map((m) => (
            <Button
              key={m}
              size="sm"
              variant={simulada === m ? "default" : "outline"}
              onClick={() => {
                const siguiente = simulada === m ? null : m;
                setSimulada(siguiente);
                void traer(siguiente);
              }}
            >
              +{m} min
            </Button>
          ))}
          {simulada !== null ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSimulada(null);
                void traer(null);
              }}
            >
              Volver al real
            </Button>
          ) : null}
        </div>

        {estado === "cargando" ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : estado === "error" || !datos ? (
          // El `!datos` es redundante en ejecución —`estadoDeLaCascada` ya lo
          // cubre— pero es lo que le permite a TypeScript estrechar abajo.
          <p className="text-sm text-muted-foreground">
            No pudimos calcular la cascada. No es que la demora no se propague:
            no tenemos el dato.
          </p>
        ) : datos.motivo ? (
          <p className="text-sm text-muted-foreground">{datos.motivo}.</p>
        ) : piernas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta demora no alcanza para arrastrar la rotación.
          </p>
        ) : (
          <>
            <p className="text-sm">
              {typeof datos?.demora_llegada_min === "number" ? (
                <>
                  Llegando{" "}
                  <span className="font-semibold tabular-nums">
                    {Math.round(datos.demora_llegada_min)} min
                  </span>{" "}
                  tarde,{" "}
                </>
              ) : null}
              <span
                className={cn(
                  "font-semibold",
                  alcanzados > 0 ? "text-risk-high" : "text-risk-low",
                )}
              >
                {alcanzados === 0
                  ? "ningún vuelo siguiente queda demorado"
                  : alcanzados === 1
                    ? "1 vuelo siguiente queda demorado"
                    : `${alcanzados} vuelos siguientes quedan demorados`}
              </span>
              .
            </p>

            <ol className="space-y-2">
              {/* eslint-disable-next-line complexity -- deuda registrada en .complejidad-baseline.json */}
              {piernas.map((p) => (
                <li key={`${p.fa_flight_id}-${p.orden}`}>
                  {p.orden > 1 ? (
                    <ArrowDown
                      className="mb-1 ml-3 size-3 text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                  <div
                    className={cn(
                      "rounded-lg border",
                      abierto ? "px-3 py-2" : "px-2.5 py-1.5",
                      p.demorado
                        ? "border-risk-high/30 bg-risk-high/5"
                        : "border-border",
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className={cn("font-mono", abierto ? "text-sm" : "text-xs")}>
                        {p.vuelo ?? p.fa_flight_id.slice(0, 10)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.origen} → {p.destino}
                        {abierto && p.salida_programada_utc
                          ? ` · ${fmtTime(p.salida_programada_utc)}`
                          : ""}
                      </span>
                    </div>
                    {/* Compacto no pierde los números, los pone en la misma
                        línea y sin las palabras que se entienden por contexto. */}
                    <div
                      className={cn(
                        "flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground",
                        abierto && "mt-1",
                      )}
                    >
                      <span>
                        {abierto ? "escala " : ""}
                        {Math.round(p.holgura_min)} min
                      </span>
                      <span
                        className={cn(
                          "tabular-nums",
                          p.demorado && "font-medium text-risk-high",
                        )}
                      >
                        {abierto ? "llega " : ""}+{Math.round(p.demora_llegada_min)} min
                      </span>
                      {p.cadena_rota && abierto ? (
                        <span className="flex items-center gap-1 text-risk-medium">
                          <TriangleAlert className="size-3" aria-hidden />
                          con esta demora la aerolínea cambia el avión
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        {abierto && datos?.aviso ? (
          <p className="text-xs text-muted-foreground">{datos.aviso}.</p>
        ) : null}
        {abierto && datos?.nota && piernas.length > 0 ? (
          <p className="text-xs text-muted-foreground">{datos.nota}.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
