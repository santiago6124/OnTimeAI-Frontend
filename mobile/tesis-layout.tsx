"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/components/providers/session-provider";

/**
 * Gate de `/tesis` en el bundle empaquetado.
 *
 * La versión de la web hace `redirect()` en el servidor, que en un export no
 * existe: los HTML ya están escritos cuando el teléfono los abre. Acá el corte
 * es en el cliente.
 *
 * No es un control de acceso y no pretende serlo: quien tenga el .ipa puede
 * abrir el HTML igual. Lo que protege los datos es el backend, que exige rol
 * `admin` o `superadmin` en los endpoints de tesis y devuelve 403 a cualquier
 * otro token. Esto solo evita que un usuario común llegue a una pantalla que
 * se le va a llenar de errores.
 */
export default function TesisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useSession();
  const allowed = user?.role === "admin" || user?.role === "superadmin";

  React.useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
