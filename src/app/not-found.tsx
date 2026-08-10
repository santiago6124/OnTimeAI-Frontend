import Link from "next/link";
import { ArrowLeft, Plane } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <AppShell title="No encontrado">
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Plane className="size-10 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-semibold">No encontramos ese vuelo o página</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                El identificador puede haber vencido o el recurso ya no está disponible.
              </p>
            </div>
            <Link href="/flights" className={buttonVariants()}>
              <ArrowLeft className="size-4" /> Volver a vuelos
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
