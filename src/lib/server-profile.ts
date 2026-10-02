import "server-only";

import { cookies } from "next/headers";

import { getVerifiedSession } from "@/lib/server-auth";
import { profileIdForUserType } from "@/lib/auth-types";

export type ProfileId = "airline" | "passenger";

const COOKIE = "ontimeai-profile";

/**
 * El perfil con el que hay que dibujar la página, resuelto en el servidor.
 *
 * Mismo orden de precedencia que `ProfileProvider` en el cliente: el override
 * local manda, y si no hay, el perfil de la cuenta. Las dos piezas tienen que
 * coincidir o la misma pantalla termina con el menú de un perfil y el
 * contenido del otro.
 *
 * Por eso el override es una cookie: `localStorage` no llega hasta acá.
 */
export async function getServerProfile(): Promise<ProfileId> {
  const session = await getVerifiedSession();
  const puedeElegir = session?.role === "admin" || session?.role === "superadmin";

  if (puedeElegir) {
    const guardado = (await cookies()).get(COOKIE)?.value;
    if (guardado === "airline" || guardado === "passenger") return guardado;
  }

  return session?.userType ? profileIdForUserType(session.userType) : "passenger";
}
