import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

export async function ModelBadge() {
  let info;
  try {
    info = await api.model();
  } catch {
    info = null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Activity className="size-4" />
          Modelo activo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {info?.version ?? "—"}
          </Badge>
          <span className="text-xs text-muted-foreground">{info?.active_model ?? ""}</span>
        </div>
        {info?.live_auc != null && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground">AUC live</span>
            <span className="font-mono font-medium">{info.live_auc.toFixed(3)}</span>
            <span className="text-muted-foreground">Brier</span>
            <span className="font-mono font-medium">{info.live_brier?.toFixed(3)}</span>
            <span className="text-muted-foreground">Actuals</span>
            <span className="font-mono font-medium">{info.n_actuals?.toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
