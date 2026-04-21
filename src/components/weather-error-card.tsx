import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WeatherErrorCard({
  message,
  source = "Aviation Weather Center (NOAA)",
}: {
  message: string;
  source?: string;
}) {
  return (
    <Card className="border-risk-high/40 bg-risk-high/5">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-risk-high/10 text-risk-high">
            <AlertTriangle className="size-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-base">
              No se pudieron cargar los datos del clima
            </CardTitle>
            <CardDescription>
              Fallo al consultar {source}. Revisá tu conexión o volvé a intentar
              en unos minutos.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Detalle técnico
          </div>
          <code className="block break-all rounded bg-muted px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
            {message}
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
