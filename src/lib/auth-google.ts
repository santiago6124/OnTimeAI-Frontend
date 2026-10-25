/**
 * Entrar con Google, por un solo camino.
 *
 * Lo único que cambia entre la web y el teléfono es **de dónde sale el ID
 * token de Google**: en el navegador lo da Google Identity Services, y en el
 * teléfono el plugin nativo, porque GIS no corre dentro de un WebView. De ahí
 * en adelante las dos ramas hacen exactamente lo mismo.
 *
 * ```
 *   GIS (web)  ─┐
 *               ├─→ signInWithCredential ──→ ID token de Firebase ──→ /auth/firebase
 *   plugin ────┘        (Firebase)
 * ```
 *
 * ## Por qué esto antes eran dos sistemas
 *
 * El botón de la web se construyó en septiembre, antes de que el proyecto
 * tuviera Firebase, y cambiaba el token contra `/auth/google` —un endpoint que
 * verifica el token de Google por su cuenta—. Cuando llegó Firebase se migró
 * el correo y contraseña, pero ese botón quedó donde estaba porque funcionaba.
 *
 * El costo no era teórico: los usuarios que entraban por la web **no existían
 * en Firebase**. Medido sobre producción antes de este cambio, cuatro de los
 * cinco usuarios con `provider='google'` no tenían cuenta de Firebase, uno de
 * ellos dado de alta un mes después de que Firebase estuviera en uso. Firebase
 * no era el padrón completo, y esa gente no podía recuperar su contraseña ni
 * vincular proveedores.
 *
 * No partía cuentas, eso sí: los dos endpoints guardan por email, así que la
 * misma persona caía siempre en la misma fila de `users.db`. Era inconsistencia
 * de identidad, no de datos.
 *
 * ## Por qué el token de la web sirve
 *
 * Firebase tiene su propio client ID para Google, distinto del que usa GIS en
 * la web. Acepta igual el de la web porque los dos pertenecen al mismo
 * proyecto de Google Cloud, y eso no es una suposición: el camino nativo ya
 * venía mandando ese mismo `aud` —va como `iOSServerClientId`— y Firebase
 * vinculó el proveedor sin quejarse.
 *
 * ## Qué pasa con los usuarios viejos
 *
 * Nada que haya que migrar a mano. La próxima vez que entren, Firebase les crea
 * la cuenta y el backend los encuentra por email en la fila que ya tienen.
 * Convergen solos.
 */
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

import { apiLoginFirebase } from "@/lib/api";
import { type SessionUser } from "@/lib/auth-types";
import { firebaseAuth } from "@/lib/firebase";
import { pedirIdTokenDeGoogle } from "@/lib/native/google-sign-in";

export type SesionDeGoogle = SessionUser & { isNewUser: boolean };

/**
 * El tramo común: de un ID token de Google a la sesión propia.
 *
 * `signInWithCredential` es la única operación de Auth de Firebase que sirve
 * en el bundle de iOS: es una llamada HTTP y no necesita el popup/redirect
 * resolver, que `firebase.ts` omite a propósito porque desde
 * `capacitor://localhost` su iframe nunca contesta y deja todo encolado para
 * siempre, sin error ni timeout.
 */
async function sesionDesdeIdTokenDeGoogle(
  googleIdToken: string,
): Promise<SesionDeGoogle> {
  const credencial = GoogleAuthProvider.credential(googleIdToken);
  const { user } = await signInWithCredential(firebaseAuth(), credencial);
  return apiLoginFirebase(await user.getIdToken());
}

/** Web: el ID token ya lo consiguió el botón de Google Identity Services. */
export async function sesionConCredencialDeGoogle(
  googleIdToken: string,
): Promise<SesionDeGoogle> {
  return sesionDesdeIdTokenDeGoogle(googleIdToken);
}

/** Teléfono: abre la hoja nativa de Google y vuelve con la sesión propia. */
export async function sesionConGoogleNativo(): Promise<SesionDeGoogle> {
  return sesionDesdeIdTokenDeGoogle(await pedirIdTokenDeGoogle());
}
