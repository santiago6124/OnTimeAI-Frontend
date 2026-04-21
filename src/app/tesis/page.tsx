import Link from "next/link";
import {
  ArrowRight,
  CloudSun,
  EyeOff,
  FlaskConical,
  Plane,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const EXPERIMENTS = [
  {
    href: "/tesis/flights",
    icon: Plane,
    title: "Radar predictivo de vuelos",
    description:
      "Mapa mundial tipo Flightradar24 con rutas simuladas desde ATL, aviones coloreados por riesgo predicho y rotación real por bearing great-circle.",
    status: "Fuera del MVP — requiere streaming",
  },
  {
    href: "/tesis/weather",
    icon: CloudSun,
    title: "Mapa meteorológico operativo",
    description:
      "Estaciones NOAA georreferenciadas con halos de impacto proyectado sobre la puntualidad de vuelos ATL.",
    status: "Fuera del MVP — requiere ingesta NOAA tiles",
  },
];

export const metadata = {
  title: "Laboratorio de tesis — OnTimeAI",
  description: "Vistas experimentales fuera del alcance del MVP.",
  robots: { index: false, follow: false },
};

export default function TesisPage() {
  return (
    <AppShell title="Laboratorio de tesis">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <EyeOff className="size-3" />
              Vista oculta
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-risk-medium">
              <FlaskConical className="size-3" />
              Fuera del MVP
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Laboratorio experimental
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Estas vistas no forman parte del alcance del MVP (predicción batch
            offline para ATL sin streaming ni efecto cascada). Se mantienen acá
            a modo de exploración para iteraciones futuras y para la defensa
            académica del trabajo final. No están enlazadas desde la navegación
            principal.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {EXPERIMENTS.map((e) => {
            const Icon = e.icon;
            return (
              <Link key={e.href} href={e.href} className="group">
                <Card className="h-full transition-colors group-hover:border-primary">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    <CardTitle className="mt-3 text-base">{e.title}</CardTitle>
                    <CardDescription>{e.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {e.status}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Por qué estas vistas están ocultas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              El ante-proyecto delimita explícitamente el alcance en predicción
              batch offline para el aeropuerto ATL (Hartsfield-Jackson). Quedan
              <strong className="text-foreground"> fuera del MVP</strong>:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Predicción en tiempo real (streaming).</li>
              <li>Efecto cascada entre vuelos y mapa de propagación.</li>
              <li>Integración con OpenSky / ADS-B para posición live.</li>
            </ul>
            <p>
              Las vistas acá usan datos simulados y existen para{" "}
              <strong className="text-foreground">
                demostrar extensibilidad
              </strong>{" "}
              del sistema y sustentar casos de uso futuros.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
