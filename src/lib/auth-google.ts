/**
 * Las dos formas de entrar con Google, detrás de una sola firma.
 *
 * Las páginas de login y de alta no tienen por qué saber en qué plataforma
 * corren: piden una sesión y reciben una sesión. Antes cada una repetía el
 * manejo del token y del error, y la rama nativa habría duplicado eso otra vez.
 *
 * ## Por qué los dos caminos no son el mismo
 *
 * | | de dónde sale el token | contra qué se cambia |
 * |---|---|---|
 * | web | Google Identity Services, en el navegador | `/auth/google` |
 * | teléfono | plugin nativo → `signInWithCredential` de Firebase | `/auth/firebase` |
 *
 * La web sigue por `/auth/google` porque hoy funciona y migrarla sin que el
 * proveedor de Google esté habilitado en Firebase la rompería. El camino
 * nativo entra por Firebase desde el principio, que es la dirección decidida:
 * un solo sistema de credenciales en vez de dos. Cuando el interruptor de
 * Firebase esté prendido, la web se muda acá y `/auth/google` se jubila.
 */
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

import { apiLoginFirebase, apiLoginGoogle } from "@/lib/api";
import { type SessionUser } from "@/lib/auth-types";
import { firebaseAuth } from "@/lib/firebase";
import { pedirIdTokenDeGoogle } from "@/lib/native/google-sign-in";

export type SesionDeGoogle = SessionUser & { isNewUser: boolean };

/**
 * Web: el ID token ya lo consiguió el botón de Google Identity Services.
 */
export async function sesionConCredencialDeGoogle(
  googleIdToken: string,
): Promise<SesionDeGoogle> {
  return apiLoginGoogle(googleIdToken);
}

/**
 * Teléfono: abre la hoja nativa de Google y vuelve con la sesión propia.
 *
 * El paso del medio es el que importa: el ID token que da el plugin es de
 * Google, y `/auth/firebase` espera uno de Firebase. `signInWithCredential`
 * convierte uno en el otro, y es la única operación de Auth de Firebase que se
 * puede usar en el bundle de iOS —es una llamada HTTP y no necesita el
 * popup/redirect resolver, que ahí nunca contesta.
 */
export async function sesionConGoogleNativo(): Promise<SesionDeGoogle> {
  const googleIdToken = await pedirIdTokenDeGoogle();
  const credencial = GoogleAuthProvider.credential(googleIdToken);
  const { user } = await signInWithCredential(firebaseAuth(), credencial);
  return apiLoginFirebase(await user.getIdToken());
}
