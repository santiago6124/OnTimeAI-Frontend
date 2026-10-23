/**
 * Login con Apple en el bundle de iOS, por el mismo plugin que el de Google.
 *
 * ## Por qué existe
 *
 * Guideline 4.8 de App Store: una app que ofrece un login de terceros (Google,
 * desde el PR #75) tiene que ofrecer también uno "equivalente en privacidad",
 * que en la práctica es Sign in with Apple. Sin esto el binario que trae
 * "Continuar con Google" vuelve rechazado de la revisión.
 *
 * ## El camino
 *
 * Igual que Google: el plugin abre la hoja nativa de Apple y devuelve un
 * identity token DE APPLE, y `signInWithCredential` lo cambia por una sesión de
 * Firebase, que es lo que `/auth/firebase` verifica. Un solo sistema de
 * credenciales. `signInWithCredential` es una llamada HTTP y anda en el bundle;
 * `signInWithPopup` no, por el resolver que `firebase.ts` omite a propósito.
 *
 * ## El nonce
 *
 * Firebase exige un nonce en las credenciales de Apple, y no es decorativo: es
 * lo que impide que alguien que robó un identity token lo reuse. Va en dos
 * formas distintas y confundirlas falla en silencio con `auth/invalid-credential`:
 *
 * - a Apple se le pasa el **SHA-256** del nonce, y Apple lo firma dentro del token;
 * - a Firebase se le pasa el nonce **crudo**, y Firebase lo hashea y compara.
 *
 * El plugin pasa `nonce` tal cual a `ASAuthorizationAppleIDRequest.nonce`, sin
 * hashear: el hash lo hacemos acá.
 *
 * ## Por qué hay una marca en el user agent
 *
 * El plugin ya está en el binario 1.1.0 (7) —es el mismo de Google—, así que
 * `isPluginAvailable` da `true` también ahí. Lo que ese binario NO tiene es el
 * entitlement `com.apple.developer.applesignin`, y sin él la hoja de Apple
 * falla con `AuthorizationError 1000` apenas se toca el botón. Como un bundle
 * nuevo llega por OTA a binarios viejos, preguntar por el plugin no alcanza.
 *
 * Desde JS no se pueden leer los entitlements, así que el parche que los pone
 * (`scripts/ios-patch-apple.sh`) agrega además `OnTimeAI-SIWA/1` al user agent
 * del WebView, en el `capacitor.config.json` del binario. Ese archivo vive en
 * el .ipa y no en el zip del OTA: la marca la tiene exactamente el binario que
 * tiene el entitlement.
 */
import { pluginNativoPresente, plataformaActual, type Plataforma } from "@/lib/native/google-sign-in";

/** Lo que `ios-patch-apple.sh` agrega al user agent. Cambiarlo acá exige cambiarlo allá. */
export const MARCA_USER_AGENT = "OnTimeAI-SIWA/1";

/**
 * Si el binario que corre puede atender Sign in with Apple.
 *
 * Solo iOS: en Android haría falta el flujo web de Apple con un Services ID y
 * una URL de vuelta, y Apple no exige el botón ahí (4.8 es una regla de App
 * Store). En la web tampoco: el camino de la web es Google Identity Services.
 */
export function appleDisponibleEn(plataforma: Plataforma, userAgent: string): boolean {
  return plataforma === "ios" && userAgent.includes(MARCA_USER_AGENT);
}

/** El gate completo: plataforma, binario con el entitlement y plugin presente. */
export async function appleNativoListo(): Promise<boolean> {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (!appleDisponibleEn(await plataformaActual(), userAgent)) return false;
  return pluginNativoPresente();
}

// --- Nonce ----------------------------------------------------------------

/** 32 bytes al azar en hex: 256 bits, sin sesgo y sin caracteres raros. */
export function generarNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return aHex(bytes);
}

function aHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 en hex, que es el formato que Firebase compara.
 *
 * Prefiere `crypto.subtle`, pero no depende de él: solo existe en contextos
 * seguros, y no hay forma de verificar desde acá que `capacitor://localhost`
 * cuente como uno en todas las versiones de iOS que soporta la app. Si faltara,
 * el botón fallaría siempre y solo en el teléfono; el respaldo en JS cuesta
 * cuarenta líneas y lo fija una prueba contra los vectores del estándar.
 */
export async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const sutil = globalThis.crypto?.subtle;
  if (sutil) return aHex(new Uint8Array(await sutil.digest("SHA-256", datos)));
  return sha256HexEnJs(datos);
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** FIPS 180-4, tal cual. Exportada solo para que la prueba la ejercite directo. */
export function sha256HexEnJs(datos: Uint8Array): string {
  // Relleno: un 1, ceros, y el largo en bits en los últimos 8 bytes.
  const largo = Math.ceil((datos.length + 9) / 64) * 64;
  const m = new Uint8Array(largo);
  m.set(datos);
  m[datos.length] = 0x80;
  const vista = new DataView(m.buffer);
  vista.setUint32(largo - 4, datos.length * 8);
  vista.setUint32(largo - 8, Math.floor((datos.length * 8) / 2 ** 32));

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let bloque = 0; bloque < largo; bloque += 64) {
    for (let i = 0; i < 16; i++) w[i] = vista.getUint32(bloque + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    const v = Uint32Array.from(h);
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(v[4], 6) ^ rotr(v[4], 11) ^ rotr(v[4], 25);
      const t1 = v[7] + S1 + ((v[4] & v[5]) ^ (~v[4] & v[6])) + K[i] + w[i];
      const S0 = rotr(v[0], 2) ^ rotr(v[0], 13) ^ rotr(v[0], 22);
      const t2 = S0 + ((v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]));
      v.copyWithin(1, 0, 7);
      v[4] += t1;
      v[0] = t1 + t2;
    }
    for (let i = 0; i < 8; i++) h[i] += v[i];
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}

// --- El plugin --------------------------------------------------------------

export class AppleNativoError extends Error {
  constructor(
    message: string,
    /** El usuario cerró la hoja de Apple: no es una falla, es un "no". */
    readonly cancelado = false,
  ) {
    super(message);
    this.name = "AppleNativoError";
  }
}

/** Lo que hace falta para armar la credencial de Firebase y, si toca, revocar. */
export type CredencialDeApple = {
  idToken: string;
  rawNonce: string;
  /**
   * El authorization code de Apple: de un solo uso y válido cinco minutos. Solo
   * sirve para revocar el acceso al dar de baja la cuenta (ver `auth-apple.ts`).
   */
  codigo: string | null;
};

/**
 * Si el error del plugin es el "cancelar" de la hoja de Apple.
 *
 * El plugin rechaza con el `localizedDescription` del `NSError` y no expone el
 * código, así que se lo busca en el texto: `ASAuthorizationError.canceled` es
 * el 1001 del dominio `AuthorizationError`.
 */
export function esCancelacion(error: unknown): boolean {
  const texto = error instanceof Error ? error.message : String(error);
  return /AuthorizationError[^0-9]*1001/.test(texto);
}

/**
 * `initialize` una vez por proceso, con la misma lógica de promesa compartida
 * que el de Google (`google-sign-in.ts`). Son llamadas separadas a propósito:
 * el plugin inicializa cada proveedor que encuentra en el objeto y deja en paz
 * a los demás, así que Apple no le pisa la configuración a Google.
 */
let inicializacion: Promise<void> | null = null;

function inicializar(): Promise<void> {
  if (inicializacion) return inicializacion;
  inicializacion = (async () => {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({
      apple: {
        // Vacío en iOS: con una URL, el plugin le manda el código a ese
        // backend en vez de devolverlo. Acá no hay backend de por medio.
        redirectUrl: "",
        // En modo `false` el plugin devuelve el authorization code dentro de
        // `accessToken.token` y no hace ninguna llamada de red. En `true`
        // pondría el código en `authorizationCode`, pero la versión 7.20 no lo
        // copia a la respuesta que llega a JS: se perdería.
        useProperTokenExchange: false,
      },
    });
  })();
  inicializacion.catch(() => {
    inicializacion = null;
  });
  return inicializacion;
}

/**
 * Abre la hoja nativa de Apple y devuelve el identity token con su nonce.
 *
 * Quien lo llama lo convierte en credencial de Firebase con
 * `OAuthProvider("apple.com").credential({ idToken, rawNonce })`.
 */
export async function pedirCredencialDeApple(): Promise<CredencialDeApple> {
  if (!(await appleNativoListo())) {
    throw new AppleNativoError(
      "El acceso con Apple no está disponible en esta versión de la app.",
    );
  }

  const rawNonce = generarNonce();
  const respuesta = await abrirHojaDeApple(await sha256Hex(rawNonce));
  return { rawNonce, ...leerRespuesta(respuesta.result) };
}

/** La llamada al plugin, con los errores ya traducidos. */
async function abrirHojaDeApple(nonce: string) {
  await inicializar();
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  try {
    // Sin `scopes`: el plugin los castea a `[ASAuthorization.Scope]` y un array
    // de strings no pasa el cast, así que igual usaría su default, que es
    // nombre y correo —lo que queremos—.
    return await SocialLogin.login({ provider: "apple", options: { nonce } });
  } catch (causa) {
    if (esCancelacion(causa)) {
      throw new AppleNativoError("Cancelaste el acceso con Apple.", true);
    }
    throw new AppleNativoError(
      "Apple no pudo completar el acceso. Probá de nuevo o entrá con tu correo.",
    );
  } finally {
    // El plugin guarda el identity token en `UserDefaults` para su propio
    // logout. No lo usamos, y es un JWT con el correo adentro: no hay por qué
    // dejarlo ahí.
    await olvidarEstadoDelPlugin();
  }
}

/**
 * El identity token y el código, de una respuesta tipada como la de cualquier
 * proveedor: se la lee como forma, no por tipo.
 */
function leerRespuesta(resultado: unknown): Omit<CredencialDeApple, "rawNonce"> {
  const r = (resultado ?? {}) as { idToken?: string | null; accessToken?: { token?: string } | null };
  if (!r.idToken) {
    throw new AppleNativoError(
      "Apple no devolvió una credencial. Probá de nuevo o entrá con tu correo.",
    );
  }
  return { idToken: r.idToken, codigo: r.accessToken?.token || null };
}

async function olvidarEstadoDelPlugin(): Promise<void> {
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.logout({ provider: "apple" });
  } catch {
    // Sin estado guardado el plugin rechaza el logout; no hay nada que limpiar.
  }
}
