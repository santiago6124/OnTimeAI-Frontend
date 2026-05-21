import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Eye, Thermometer, Wind } from "lucide-react";
import { api, type WeatherData } from "@/lib/api";

function toF(c: number | null): string {
  if (c === null) return "--";
  return `${Math.round(c * 9 / 5 + 32)}°F`;
}

function buildCondition(d: WeatherData): string {
  const parts: string[] = [];
  if (d.wx_codes) parts.push(d.wx_codes);
  if (d.precip_flag) parts.push("Precipitación");
  if (d.low_visibility) parts.push("Baja visibilidad");
  if (d.strong_wind) parts.push("Vientos fuertes");
  return parts.length > 0 ? parts.join(" · ") : "Despejado";
}

function buildMetar(d: WeatherData): string {
  const dt = new Date(d.valid_utc.endsWith("Z") ? d.valid_utc : d.valid_utc + "Z");
  const day = dt.getUTCDate().toString().padStart(2, "0");
  const hhmm = `${dt.getUTCHours().toString().padStart(2, "0")}${dt.getUTCMinutes().toString().padStart(2, "0")}`;
  const dir = d.wind_direction?.toString().padStart(3, "0") ?? "VRB";
  const spd = Math.round(d.wind_knots ?? 0).toString().padStart(2, "0");
  const gust = d.gust_knots ? `G${Math.round(d.gust_knots).toString().padStart(2, "0")}` : "";
  const vis = d.visibility_miles != null ? `${d.visibility_miles}SM` : "";
  const wx = d.wx_codes ?? "";
  const t = Math.round(d.temperature_c ?? 0);
  const td = Math.round(d.dewpoint_c ?? 0);
  const tStr = `${t < 0 ? "M" : ""}${Math.abs(t).toString().padStart(2, "0")}/${td < 0 ? "M" : ""}${Math.abs(td).toString().padStart(2, "0")}`;
  const alti = d.altimeter_inhg != null ? `A${Math.round(d.altimeter_inhg * 100)}` : "";
  return `KATL ${day}${hhmm}Z ${dir}${spd}${gust}KT ${vis} ${wx} ${tStr} ${alti}`.replace(/\s{2,}/g, " ").trim();
}

export async function WeatherCard({ title = "Condiciones meteorológicas ATL" }: { title?: string }) {
  let data: WeatherData | null = null;
  try {
    data = await api.weather("ATL");
  } catch {
    // no weather data available
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Cloud className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin datos meteorológicos disponibles.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <WeatherStat icon={<Thermometer className="size-4" />} label="Temp" value={toF(data.temperature_c)} />
              <WeatherStat icon={<Wind className="size-4" />} label="Viento" value={`${Math.round(data.wind_knots ?? 0)} kt`} />
              <WeatherStat icon={<Eye className="size-4" />} label="Visibilidad" value={data.visibility_miles != null ? `${data.visibility_miles} SM` : "--"} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Condición actual</div>
              <div className="text-sm">{buildCondition(data)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">METAR</div>
              <code className="block rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {buildMetar(data)}
              </code>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Actualizado: {new Date(data.valid_utc.endsWith("Z") ? data.valid_utc : data.valid_utc + "Z").toLocaleString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} UTC
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WeatherStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
