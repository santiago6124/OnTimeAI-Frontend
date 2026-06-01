import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Cloud, Eye, Thermometer, Wind } from "lucide-react";
import { api, ApiError, type WeatherData } from "@/lib/api";
import { cn } from "@/lib/utils";

function toF(c: number | null): string {
  if (c === null) return "—";
  return `${Math.round(c * 9 / 5 + 32)}°F`;
}

const WX_LABELS: Record<string, string> = {
  BR: "Niebla ligera", FG: "Niebla", HZ: "Neblina", FU: "Humo",
  RA: "Lluvia", DZ: "Llovizna", SN: "Nieve", SG: "Nieve granulada",
  IC: "Cristales de hielo", PL: "Aguanieve", GR: "Granizo", GS: "Granizo fino",
  TS: "Tormenta eléctrica", SH: "Chubascos", FZ: "Engelante",
  SA: "Arena", DU: "Polvo", PO: "Torbellino", SQ: "Turbonada",
  FC: "Nube embudo", SS: "Tormenta de arena", DS: "Tormenta de polvo", VA: "Ceniza volcánica",
};

function translateWx(wx: string): string {
  const upper = wx.toUpperCase().trim();
  for (const [code, label] of Object.entries(WX_LABELS)) {
    if (upper.includes(code)) return label;
  }
  return upper;
}

function validWx(wx: string | null | undefined): string | null {
  if (!wx || wx === "M" || wx.trim() === "") return null;
  return wx.trim();
}

function buildCondition(d: WeatherData): string {
  const parts: string[] = [];
  const wx = validWx(d.wx_codes);
  if (wx) parts.push(translateWx(wx));
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
  const wx = validWx(d.wx_codes) ?? "";
  const t = Math.round(d.temperature_c ?? 0);
  const td = Math.round(d.dewpoint_c ?? 0);
  const tStr = `${t < 0 ? "M" : ""}${Math.abs(t).toString().padStart(2, "0")}/${td < 0 ? "M" : ""}${Math.abs(td).toString().padStart(2, "0")}`;
  const alti = d.altimeter_inhg != null ? `A${Math.round(d.altimeter_inhg * 100)}` : "";
  return `KATL ${day}${hhmm}Z ${dir}${spd}${gust}KT ${vis} ${wx} ${tStr} ${alti}`.replace(/\s{2,}/g, " ").trim();
}

function conditionSeverity(d: WeatherData): "normal" | "caution" | "severe" {
  if (d.low_visibility || d.strong_wind) return "severe";
  if (d.precip_flag || validWx(d.wx_codes)) return "caution";
  return "normal";
}

export async function WeatherCard({ title = "Condiciones meteorológicas ATL" }: { title?: string }) {
  let data: WeatherData | null = null;
  let errorKind: "unavailable" | "server" | null = null;
  try {
    data = await api.weather("ATL");
  } catch (e) {
    errorKind = e instanceof ApiError && e.status === 404 ? "unavailable" : "server";
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
        {errorKind === "server" ? (
          <div className="flex items-center gap-2 py-4 text-sm text-risk-high">
            <AlertTriangle className="size-4 shrink-0" />
            No se pudo conectar con el servidor meteorológico.
          </div>
        ) : errorKind === "unavailable" ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin datos meteorológicos disponibles aún.
          </p>
        ) : data ? (
          <>
            {/* Condition banner */}
            {conditionSeverity(data) !== "normal" && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium",
                  conditionSeverity(data) === "severe"
                    ? "bg-risk-high/10 text-risk-high"
                    : "bg-risk-medium/10 text-risk-medium",
                )}
              >
                <span className={cn(
                  "size-1.5 rounded-full",
                  conditionSeverity(data) === "severe" ? "bg-risk-high" : "bg-risk-medium",
                )} />
                {buildCondition(data)}
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              <WeatherStat
                icon={<Thermometer className="size-3.5" />}
                label="Temp"
                value={toF(data.temperature_c)}
              />
              <WeatherStat
                icon={<Wind className="size-3.5" />}
                label="Viento"
                value={`${Math.round(data.wind_knots ?? 0)} kt`}
                alert={data.strong_wind}
              />
              <WeatherStat
                icon={<Eye className="size-3.5" />}
                label="Visib."
                value={data.visibility_miles != null ? `${data.visibility_miles} SM` : "—"}
                alert={data.low_visibility}
              />
            </div>

            {conditionSeverity(data) === "normal" && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="size-1.5 rounded-full bg-risk-low" />
                Despejado
              </div>
            )}

            {/* METAR */}
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">METAR</div>
              <code className="block rounded bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {buildMetar(data)}
              </code>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Actualizado:{" "}
              {new Date(
                data.valid_utc.endsWith("Z") ? data.valid_utc : data.valid_utc + "Z",
              ).toLocaleString("es-AR", {
                timeZone: "UTC",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              UTC
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WeatherStat({
  icon,
  label,
  value,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-md border p-2 transition-colors",
      alert ? "border-risk-high/30 bg-risk-high/5" : "bg-muted/30",
    )}>
      <div className={cn(
        "flex items-center gap-1 text-[10px] uppercase tracking-wide",
        alert ? "text-risk-high" : "text-muted-foreground",
      )}>
        {icon}
        {label}
      </div>
      <div className={cn(
        "mt-1 font-mono text-sm font-medium",
        alert && "text-risk-high",
      )}>
        {value}
      </div>
    </div>
  );
}
