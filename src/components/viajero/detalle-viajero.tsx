import { Suspense } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeatherCard } from "@/components/weather-card";
import { BotonGuardar } from "@/components/viajero/boton-guardar";
import { cn } from "@/lib/utils";
import { fmtTime, toUTCDate, type Flight } from "@/lib/api";
import { motivosParaViajero, veredicto } from "@/lib/motivos-viajero";

/**
 * El detalle de vuelo para un pasajero.
 *
 * La versión de operaciones muestra el SHAP con los nombres de las features,
 * la evolución de la probabilidad ciclo a ciclo, el umbral usado y la versión
 * del artefacto. Todo eso es correcto y necesario para quien opera; para
 * alguien que se va de viaje es ruido que tapa las tres cosas que importa
 * saber: si va a salir en horario, a qué hora sale realmente, y por qué.
 */
export function DetalleViajero({
  flight,
  guardado = false,
}: {
  flight: Flight;
  guardado?: boolean;
}) {
  const prob = flight.delay_probability ?? 0;
  const { titulo, detalle } = veredicto(prob);
  const motivos = motivosParaViajero(flight.shap);

  const corrida =
    flight.estimated_out_utc &&
    flight.scheduled_out_utc &&
    toUTCDate(flight.estimated_out_utc).getTime() >
      toUTCDate(flight.scheduled_out_utc).getTime() + 60_000;

  const tono =
    prob >= 0.5
      ? { icono: TriangleAlert, color: "text-risk-high", fondo: "bg-risk-high/5", borde: "border-risk-high/30" }
      : prob >= 0.2
        ? { icono: CircleAlert, color: "text-risk-medium", fondo: "bg-risk-medium/5", borde: "border-risk-medium/30" }
        : { icono: CheckCircle2, color: "text-risk-low", fondo: "bg-risk-low/5", borde: "border-risk-low/30" };
  const Icono = tono.icono;

  return (
    <AppShell title={`Vuelo ${flight.flight_number}`}>
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <BackButton />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">
              {flight.flight_number}
            </h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {flight.origin}
              <ArrowRight className="size-3.5" />
              {flight.destination}
            </p>
          </div>
          <BotonGuardar
            faFlightId={flight.fa_flight_id}
            guardadoInicial={guardado}
          />
        </div>

        {/* El veredicto, en palabras antes que en número. */}
        <Card className={cn(tono.borde, tono.fondo)}>
          <CardContent className="flex items-start gap-4 py-6">
            <Icono className={cn("mt-0.5 size-7 shrink-0", tono.color)} />
            <div className="space-y-1">
              <p className="text-lg font-semibold">{titulo}</p>
              <p className="text-sm text-muted-foreground">{detalle}</p>
              <p className="pt-1 text-sm">
                <span className={cn("font-semibold tabular-nums", tono.color)}>
                  {Math.round(prob * 100)}%
                </span>{" "}
                <span className="text-muted-foreground">
                  de probabilidad de llegar con más de 15 minutos de retraso
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Horarios. Lo primero que mira alguien que viaja. */}
        <Card>
          <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
            <Horario
              etiqueta="Sale de Atlanta"
              programado={flight.scheduled_out_utc}
              estimado={corrida ? flight.estimated_out_utc : null}
            />
            <Horario
              etiqueta={`Llega a ${flight.destination}`}
              programado={flight.scheduled_in_utc}
              estimado={flight.estimated_in_utc}
            />
          </CardContent>
        </Card>

        {motivos.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Por qué
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              {motivos.map((m) => (
                <div key={m.texto} className="space-y-1">
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        m.enContra ? "bg-risk-high" : "bg-risk-low",
                      )}
                      aria-hidden
                    />
                    {/* Los que cayeron al respaldo llevan la etiqueta técnica
                        del backend. Se muestran igual —omitirlos dejaba al
                        27,5% de los vuelos sin su razón principal— pero más
                        apagados, para no hacerlos pasar por una frase
                        redactada. */}
                    <span
                      className={cn(
                        "text-sm",
                        m.generico && "text-muted-foreground",
                      )}
                    >
                      {m.texto}
                    </span>
                  </div>
                  {/* La barra dice cuánto pesa cada motivo frente al primero.
                      Sin esto, cuatro frases parecen igual de importantes. */}
                  <div
                    className="ml-3.5 h-1 rounded-full bg-muted"
                    aria-hidden
                  >
                    <div
                      className={cn(
                        "h-1 rounded-full",
                        m.enContra ? "bg-risk-high/50" : "bg-risk-low/50",
                      )}
                      style={{ width: `${Math.max(8, m.peso * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Suspense
          fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}
        >
          <WeatherCard />
        </Suspense>

        {flight.has_actual && flight.arr_delay_min !== null ? (
          <Card>
            <CardContent className="py-5">
              <p className="text-sm text-muted-foreground">Cómo terminó</p>
              <p className="text-lg font-semibold">
                {flight.arr_delay_min > 15
                  ? `Llegó ${Math.round(flight.arr_delay_min)} minutos tarde`
                  : flight.arr_delay_min > 0
                    ? `Llegó ${Math.round(flight.arr_delay_min)} minutos tarde, dentro de lo normal`
                    : "Llegó en horario"}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

function Horario({
  etiqueta,
  programado,
  estimado,
}: {
  etiqueta: string;
  programado: string | null;
  estimado: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="text-xl font-semibold tabular-nums">
        {estimado ? fmtTime(estimado) : programado ? fmtTime(programado) : "—"}
      </p>
      {estimado && programado ? (
        <p className="text-xs text-muted-foreground">
          Estaba programado {fmtTime(programado)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Horario programado · UTC</p>
      )}
    </div>
  );
}
