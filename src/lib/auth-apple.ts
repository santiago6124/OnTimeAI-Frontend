/**
 * Sign in with Apple: la sesión, y la revocación al dar de baja la cuenta.
 *
 * El login es el mismo puente que el de Google en el teléfono: credencial del
 * proveedor → `signInWithCredential` de Firebase → `/auth/firebase`. Lo que es
 * propio de Apple es la baja.
 *
 * ## Por qué la baja tiene un paso más
 *
 * Guideline 5.1.1(v) y la nota de Apple de junio de 2022: una app con Sign in
 * with Apple que permite borrar la cuenta tiene que **revocar** el token de
 * Apple al borrarla. Si no, en Ajustes → Apple ID → "Apps que usan tu Apple ID"
 * OnTimeAI sigue figurando con acceso, y un alta nueva con el mismo Apple ID no
 * vuelve a pedir el consentimiento ni a entregar el nombre.
 *
 * Revocar exige un authorization code de Apple, que es de un solo uso y vence
 * a los cinco minutos: el del login de hace una semana ya no sirve. Por eso,
 * antes de borrar, se le pide al usuario que confirme con Apple una vez más, y
 * ese código fresco es el que se revoca.
 *
 * ## Por qué no `revokeAccessToken` del SDK de JS
 *
 * Existe y parece hecho para esto, pero manda el token como `ACCESS_TOKEN`:
 * espera un access token de Apple, que solo se consigue canjeando el código
 * con un client secret —o sea, en un servidor—. El SDK nativo de iOS manda el
 * código como `CODE` (`revokeToken(withAuthorizationCode:)`) y Firebase hace
 * el canje de su lado con la clave configurada en la consola. Esta es esa misma
 * llamada, hecha a mano contra el endpoint que usan los dos SDK. Además,
 * `revokeAccessToken` no hace nada —sin error— si no hay `currentUser`.
 */
import {
  OAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  type Auth,
} from "firebase/auth";

import { apiLoginFirebase } from "@/lib/api";
import { type SessionUser } from "@/lib/auth-types";
import { firebaseAuth } from "@/lib/firebase";
import {
  AppleNativoError,
  appleNativoListo,
  pedirCredencialDeApple,
  type CredencialDeApple,
} from "@/lib/native/apple-sign-in";

export type SesionDeApple = SessionUser & { isNewUser: boolean };

/** El identificador de proveedor que Firebase le da a Apple. */
export const PROVEEDOR_APPLE = "apple.com";

/**
 * La credencial de Firebase. El nonce que va acá es el CRUDO: Firebase lo
 * hashea y lo compara con el que Apple firmó dentro del token.
 */
export function credencialDeFirebase({ idToken, rawNonce }: CredencialDeApple) {
  return new OAuthProvider(PROVEEDOR_APPLE).credential({ idToken, rawNonce });
}

/** Abre la hoja de Apple y vuelve con la sesión propia. */
export async function sesionConAppleNativo(): Promise<SesionDeApple> {
  const credencial = await pedirCredencialDeApple();
  const { user } = await signInWithCredential(
    firebaseAuth(),
    credencialDeFirebase(credencial),
  );
  return apiLoginFirebase(await user.getIdToken());
}

// --- Baja de la cuenta -------------------------------------------------------

const ENDPOINT_REVOCAR = "https://identitytoolkit.googleapis.com/v2/accounts:revokeToken";

/**
 * Revoca en Apple, vía Firebase, el acceso que dio el usuario.
 *
 * Firebase canjea el código con Apple usando el Team ID, el Key ID y la clave
 * privada cargados en el proveedor Apple de la consola. Sin eso contesta con
 * error, y por eso quien llama lo trata como algo que puede fallar.
 */
export async function revocarEnApple(
  auth: Auth,
  codigo: string,
  idTokenDeFirebase: string,
): Promise<void> {
  const res = await fetch(
    `${ENDPOINT_REVOCAR}?key=${encodeURIComponent(auth.config.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: PROVEEDOR_APPLE,
        tokenType: "CODE",
        token: codigo,
        idToken: idTokenDeFirebase,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) throw new Error(`revokeToken respondió ${res.status}`);
}

/**
 * Lo que hay que hacer ANTES de `DELETE /users/me` si la cuenta entró con Apple.
 *
 * El orden importa: la revocación necesita un ID token de Firebase vigente, y
 * el backend borra la cuenta de Firebase al dar de baja. Revocar después ya no
 * tendría con qué.
 *
 * Qué pasa en cada caso:
 *
 * - **No es el bundle de iOS, o la cuenta no tiene Apple**: no hace nada.
 * - **El usuario cancela la hoja de Apple**: tira, y la baja NO sigue. Es una
 *   decisión del usuario sobre una acción irreversible; seguir de largo sería
 *   borrar algo que acaba de decir que no.
 * - **Cualquier otra falla** (Firebase sin la clave de Apple, red, un Apple ID
 *   distinto): devuelve `false` y la baja sigue. Retener la cuenta de alguien
 *   que pidió borrarla porque falló un paso accesorio es peor —y también lo
 *   exige 5.1.1(v)— que dejar el acceso de Apple sin revocar.
 *
 * Devuelve si hubo revocación, para que quien llama pueda dejar rastro.
 */
export async function revocarAppleAntesDeBorrar(): Promise<boolean> {
  if (!(await appleNativoListo())) return false;

  const auth = firebaseAuth();
  // La sesión de Firebase se restaura de IndexedDB en forma asíncrona: recién
  // abierta la app, `currentUser` puede ser null aunque haya sesión.
  await auth.authStateReady();
  const usuario = auth.currentUser;
  if (!usuario?.providerData.some((p) => p.providerId === PROVEEDOR_APPLE)) {
    return false;
  }

  let credencial: CredencialDeApple;
  try {
    credencial = await pedirCredencialDeApple();
  } catch (causa) {
    if (causa instanceof AppleNativoError && causa.cancelado) {
      throw new AppleNativoError(
        "Para eliminar una cuenta creada con Apple hace falta confirmarlo con Apple.",
        true,
      );
    }
    return false;
  }

  try {
    if (!credencial.codigo) return false;
    // `reauthenticate` y no `signIn`: si el usuario eligió otro Apple ID,
    // Firebase lo rechaza (`auth/user-mismatch`) en vez de cambiar de cuenta y
    // revocar el acceso de alguien que no está borrando nada.
    const { user } = await reauthenticateWithCredential(
      usuario,
      credencialDeFirebase(credencial),
    );
    await revocarEnApple(auth, credencial.codigo, await user.getIdToken());
    return true;
  } catch (causa) {
    console.warn("[apple] no se pudo revocar el acceso antes de la baja", causa);
    return false;
  }
}

/**
 * El mensaje para el usuario cuando falla el acceso con Apple.
 *
 * Va aparte de `mensajeDeError` de `firebase.ts` porque hay un caso que solo
 * aparece con un proveedor externo: Firebase está en "una cuenta por correo",
 * y si el correo que comparte Apple ya tiene cuenta con contraseña o con
 * Google, rechaza con `auth/account-exists-with-different-credential` en vez
 * de unirlas. Es justo lo que no tiene que decir "probá de nuevo".
 *
 * Con "Ocultar mi correo" Apple manda una dirección de
 * `privaterelay.appleid.com`, que no choca con nada: esa persona queda con una
 * cuenta nueva y separada.
 */
export function mensajeDeErrorDeApple(error: unknown): string {
  if (error instanceof AppleNativoError) return error.message;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code === "auth/account-exists-with-different-credential") {
    return "Ya tenés una cuenta con ese correo. Entrá como lo hiciste la primera vez (correo o Google).";
  }
  return error instanceof Error && !code
    ? error.message
    : "No se pudo iniciar sesión con Apple.";
}
