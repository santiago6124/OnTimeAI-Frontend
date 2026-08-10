"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppShell title="Error">
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-destructive" />
              No pudimos cargar esta vista
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Puede ser un problema temporal del backend. Reintentá sin perder tu sesión ni los filtros actuales.
            </p>
            <Button onClick={reset}>
              <RefreshCw className="size-4" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
