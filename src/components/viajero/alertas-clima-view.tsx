"use client";

import * as React from "react";
import { AlertTriangle, CloudSun, Eye, Wind } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, fmtTime, type WeatherAlert } from "@/lib/api";

/**
 * Aeropuertos con mal tiempo, de peor a mejor.
 *
 * Arranca mostrando solo los graves porque eso es lo accionable: si la lista
 * abre con los ciento y pico de aeropuertos que están bien, los dos que
 * importan se pierden adentro. Los moderados y el resto quedan a un toque.
 */

const NIVELES = [
  { id: "high" as const, etiqueta: "Solo graves" },
  { id: "medium" as const, etiqueta: "Graves y moderados" },
  { id: "all" as const, etiqueta: "Todos" },
];

const ESTILO = {
  alto: {
    borde: "border-risk-high/40",
    fondo: "bg-risk-high/5",
    texto: "text-risk-high",
    nombre: "Grave",
  },
  medio: {
    borde: "border-risk-medium/40",
    fondo: "bg-risk-medium/5",
    texto: "text-risk-medium",
    nombre: "Moderado",
  },
  bajo: {
    borde: "border-border",
    fondo: "bg-card",
    texto: "text-muted-foreground",
    nombre: "Sin novedad",
  },
} as const;

export function AlertasClimaView({
  iniciales,
}: {
  iniciales: WeatherAlert[];
}) {
  const [nivel, setNivel] = React.useState<"high" | "medium" | "all">("high");
  const [alertas, setAlertas] = React.useState(iniciales);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState("");

  async function cambiar(siguiente: "high" | "medium" | "all") {
    if (siguiente === nivel) return;
    setNivel(siguiente);
    setCargando(true);
    setError("");
    try {
      setAlertas(await api.weatherAlerts(siguiente));
    } catch {
      setError("No pudimos actualizar las alertas.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-full border bg-muted/40 p-1">
        {NIVELES.map((n) => (
          <Button
            key={n.id}
            variant={nivel === n.id ? "default" : "ghost"}
            size="sm"
            onClick={() => cambiar(n.id)}
            className="rounded-full"
          >
            {n.etiqueta}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {cargando ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : alertas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <CloudSun className="size-8 text-risk-low" />
            <p className="text-sm font-medium">
              {nivel === "high"
                ? "Ningún aeropuerto con clima grave ahora mismo"
                : "Nada para reportar con este filtro"}
            </p>
            {nivel === "high" ? (
              <p className="max-w-sm text-sm text-muted-foreground">
                Es la buena noticia. Probá «Graves y moderados» si querés ver
                los que tienen algo de viento o visibilidad reducida.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {alertas.map((a) => {
            const e = ESTILO[a.severity];
            return (
              <Card
                key={a.airport_code}
                className={cn("overflow-hidden", e.borde, e.fondo)}
              >
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-lg font-semibold">
                      {a.airport_code}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs font-medium",
                        e.texto,
                      )}
                    >
                      {a.severity !== "bajo" ? (
                        <AlertTriangle className="size-3.5" />
                      ) : null}
                      {e.nombre}
                    </span>
                  </div>

                  {a.reasons.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {a.reasons.join(" · ")}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Condiciones normales
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 text-xs tabular-nums text-muted-foreground">
                    {a.visibility_miles !== null ? (
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" />
                        {a.visibility_miles.toFixed(1)} SM
                      </span>
                    ) : null}
                    {a.wind_knots !== null ? (
                      <span className="flex items-center gap-1">
                        <Wind className="size-3" />
                        {a.wind_knots.toFixed(0)} kt
                        {a.gust_knots ? ` (ráf. ${a.gust_knots.toFixed(0)})` : ""}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-[11px] tabular-nums text-muted-foreground/80">
                    {fmtTime(a.valid_utc)} UTC
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
