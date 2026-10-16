/**
 * Cuánto antes avisa el modelo que la aerolínea (tesis, issue #5).
 *
 * Sin fetch, por el mismo motivo que `verificacion-view.tsx`: la web pide los
 * datos en el servidor durante el render y el bundle nativo en el cliente al
 * montar, pero lo que se ve en pantalla tiene que ser un solo archivo.
 *
 * Es la pantalla del argumento central de la tesis, así que lo que NO se
 * muestra importa tanto como lo que sí. Tres decisiones a propósito:
 *
 * 1. "Todavía no hay datos" no se dibuja como un cero. El registro de
 *    revisiones del carrier arrancó el 16/10/2026 y no hay dato anterior; una
 *    tarjeta con "0 min" se lee como que no tenemos ventaja.
 * 2. El tramo en que la aerolínea avisó primero se muestra en rojo y primero
 *    en la lista. Es lo que un tribunal va a buscar y esconderlo no sobrevive
 *    una pregunta.
 * 3. La advertencia de que no se mide la misma cantidad va en pantalla, no en
 *    un tooltip.
 */
import { AlertTriangle, Clock3, Eye, Target } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtTime, type LeadTime, type LeadTimeTramo } from "@/lib/api";

/** 135 → "2 h 15 min". El signo se maneja afuera. */
export function fmtMinutos(min: number) {
  const abs = Math.round(Math.abs(min));
  if (abs < 60) return `${abs} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const TRAMO_PERDIDO = "la aerolínea avisó primero";

export type EstadoVista = "cargando" | "error" | "acumulando" | "listo";

/**
 * Cuál de los cuatro estados mostrar.
 *
 * Está afuera del componente para poder probarlo: el repo no tiene
 * `testing-library` ni `jsdom`, así que el render no es testeable, y la
 * distinción que importa es justamente ésta. La primera versión decidía con
 * `fetchError || !datos` y el estado de CARGA caía en el de error: la pantalla
 * decía "no pudimos traer la métrica" mientras simplemente estaba esperando.
 *
 * Y "acumulando" no puede confundirse con "listo": con ventaja cero la
 * pantalla diría que no tenemos anticipación, cuando lo que pasa es que
 * todavía no hay con qué medirla.
 */
export function estadoDeLaVista(
  datos: LeadTime | null,
  { fetchError = false, cargando = false } = {},
): EstadoVista {
  if (cargando) return "cargando";
  if (fetchError || !datos) return "error";
  return datos.disponible ? "listo" : "acumulando";
}

export function AnticipacionView({
  datos,
  fetchError = false,
  cargando = false,
}: {
  datos: LeadTime | null;
  fetchError?: boolean;
  /** El estado de carga tiene que ser distinto del de error: con `datos` en
   *  null los dos se verían iguales y la pantalla diría "no pudimos traer la
   *  métrica" mientras simplemente está esperando. */
  cargando?: boolean;
}) {
  const estado = estadoDeLaVista(datos, { fetchError, cargando });
  return (
    <AppShell title="Anticipación frente a la aerolínea">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Anticipación frente a la aerolínea
          </h1>
          <p className="text-sm text-muted-foreground">
            Cuántos minutos antes el modelo marca un vuelo en riesgo, comparado
            con el momento en que la aerolínea publica que va a salir tarde.
          </p>
        </header>

        {estado === "cargando" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
            <div className="h-56 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : estado === "error" || !datos ? (
          // El `!datos` es redundante en tiempo de ejecución —`estadoDeLaVista`
          // ya lo cubre— pero es lo que le permite a TypeScript estrechar el
          // tipo en las ramas que siguen.
          <Aviso
            titulo="No pudimos traer la métrica"
            detalle="El backend no respondió. No es que la ventaja sea cero: no hay dato."
          />
        ) : !datos.disponible ? (
          <Acumulando datos={datos} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi
                icono={Clock3}
                etiqueta="Ventaja promedio"
                valor={
                  (datos.ventaja_promedio_min < 0 ? "−" : "") +
                  fmtMinutos(datos.ventaja_promedio_min)
                }
                nota={`mediana ${fmtMinutos(datos.ventaja_mediana_min)}`}
                malo={datos.ventaja_promedio_min < 0}
              />
              <Kpi
                icono={Target}
                etiqueta="Avisamos 1 h antes"
                valor={`${Math.round(datos.win_rate_60min * 100)}%`}
                nota={`de ${datos.n_comparables.toLocaleString("es-AR")} vuelos demorados`}
              />
              <Kpi
                icono={Eye}
                etiqueta="Puntos ciegos cubiertos"
                valor={datos.n_puntos_ciegos.toLocaleString("es-AR")}
                nota="se demoraron y la aerolínea nunca lo publicó"
              />
            </div>

            <Histograma tramos={datos.histograma} />

            <Card>
              <CardContent className="space-y-2 py-4 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-risk-medium"
                    aria-hidden
                  />
                  <span>{datos.advertencia}.</span>
                </p>
                <p>
                  Medido sobre los últimos {datos.dias} días, con{" "}
                  {datos.n_vuelos_con_resultado.toLocaleString("es-AR")} vuelos
                  con resultado real, de los cuales{" "}
                  {datos.n_demorados.toLocaleString("es-AR")} se demoraron más
                  de 15 minutos. Solo cuentan los demorados: haber avisado antes
                  sobre un vuelo que salió bien no es una ventaja.
                </p>
                {datos.desde_utc ? (
                  <p>
                    Las revisiones de la aerolínea se registran desde el{" "}
                    {fmtTime(datos.desde_utc)} UTC. No hay dato anterior.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({
  icono: Icono,
  etiqueta,
  valor,
  nota,
  malo = false,
}: {
  icono: typeof Clock3;
  etiqueta: string;
  valor: string;
  nota: string;
  malo?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icono className="size-3.5" aria-hidden />
          {etiqueta}
        </p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            malo && "text-risk-high",
          )}
        >
          {valor}
        </p>
        <p className="text-xs text-muted-foreground">{nota}</p>
      </CardContent>
    </Card>
  );
}

function Histograma({ tramos }: { tramos: LeadTimeTramo[] }) {
  const total = tramos.reduce((a, t) => a + t.n, 0);
  // El tramo perdido va primero: si quedara al final, en una lista larga se
  // lee como un residuo.
  const ordenados = [
    ...tramos.filter((t) => t.tramo === TRAMO_PERDIDO),
    ...tramos.filter((t) => t.tramo !== TRAMO_PERDIDO),
  ];
  const maximo = Math.max(1, ...tramos.map((t) => t.n));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Distribución de la ventaja
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 pb-5">
        {ordenados.map((t) => {
          const perdido = t.tramo === TRAMO_PERDIDO;
          return (
            <div key={t.tramo} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn(perdido && "text-risk-high")}>
                  {t.tramo}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {t.n.toLocaleString("es-AR")}
                  {total > 0 ? (
                    <span className="ml-1.5 text-xs">
                      {Math.round((t.n / total) * 100)}%
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted" aria-hidden>
                <div
                  className={cn(
                    "h-1.5 rounded-full",
                    perdido ? "bg-risk-high" : "bg-risk-low",
                  )}
                  style={{ width: `${(t.n / maximo) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * El estado que más va a verse al principio, y el más fácil de arruinar: si
 * acá se dibujaran tarjetas en cero, la pantalla diría que no tenemos ventaja
 * cuando lo que pasa es que todavía no hay con qué medirla.
 */
function Acumulando({ datos }: { datos: Extract<LeadTime, { disponible: false }> }) {
  return (
    <Card className="border-risk-medium/30 bg-risk-medium/5">
      <CardContent className="space-y-3 py-6">
        <p className="flex items-center gap-2 font-medium">
          <Clock3 className="size-4 text-risk-medium" aria-hidden />
          Acumulando datos
        </p>
        <p className="text-sm text-muted-foreground">{datos.motivo}.</p>
        {datos.desde_utc ? (
          <p className="text-sm text-muted-foreground">
            El registro de revisiones de la aerolínea arrancó el{" "}
            {fmtTime(datos.desde_utc)} UTC. Cada vuelo necesita haber vivido su
            ventana completa dentro de ese período para poder compararse, así
            que los primeros resultados tardan unos días.
          </p>
        ) : null}
        {typeof datos.n_demorados === "number" ? (
          <dl className="grid grid-cols-3 gap-3 pt-1 text-sm">
            <Dato etiqueta="con resultado" valor={datos.n_vuelos_con_resultado} />
            <Dato etiqueta="demorados" valor={datos.n_demorados} />
            <Dato etiqueta="puntos ciegos" valor={datos.n_puntos_ciegos} />
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="font-semibold tabular-nums">
        {(valor ?? 0).toLocaleString("es-AR")}
      </dd>
    </div>
  );
}

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <Card className="border-risk-high/30 bg-risk-high/5">
      <CardContent className="space-y-1 py-6">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4 text-risk-high" aria-hidden />
          {titulo}
        </p>
        <p className="text-sm text-muted-foreground">{detalle}</p>
      </CardContent>
    </Card>
  );
}
