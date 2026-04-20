import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Eye, Thermometer, Wind } from "lucide-react";
import { MOCK_METRICS } from "@/lib/mock-data";

export function WeatherCard() {
  const w = MOCK_METRICS.weather;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Cloud className="size-4 text-muted-foreground" />
          Condiciones meteorológicas ATL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <WeatherStat
            icon={<Thermometer className="size-4" />}
            label="Temp"
            value={`${w.temperatureF}°F`}
          />
          <WeatherStat
            icon={<Wind className="size-4" />}
            label="Viento"
            value={`${w.windKt} kt`}
          />
          <WeatherStat
            icon={<Eye className="size-4" />}
            label="Visibilidad"
            value={`${w.visibilitySm} SM`}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Condición actual</div>
          <div className="text-sm">{w.condition}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">METAR</div>
          <code className="block rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {w.metar}
          </code>
        </div>
      </CardContent>
    </Card>
  );
}

function WeatherStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}
