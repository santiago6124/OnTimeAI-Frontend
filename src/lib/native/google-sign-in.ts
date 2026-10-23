/**
 * Login con Google en el teléfono, por plugin nativo.
 *
 * ## Por qué hace falta un plugin
 *
 * Google Identity Services —el botón de la web— se niega a correr dentro de un
 * WebView embebido: rechaza el flujo con `disallowed_useragent`. Es una
 * política de Google para que una app no pueda ponerle una pantalla de login de
 * Google falsa al usuario, así que no hay forma de sortearla desde JS.
 *
 * Afecta a las dos plataformas, no solo al bundle: Android corre la web remota
 * de Cloud Run, pero la corre en un WebView, y ahí la pared es la misma.
 *
 * ## Por qué el plugin tampoco alcanza solo
 *
 * El plugin devuelve un ID token DE GOOGLE. La sesión de esta app no se arma
 * con eso: se arma con un ID token de FIREBASE, que es lo que `/auth/firebase`
 * verifica. El puente entre los dos es `signInWithCredential`, y es la pieza
 * que hace que esto no agregue un tercer camino de credenciales — Google entra
 * por Firebase, igual que el correo y contraseña.
 *
 * `signInWithCredential` sí se puede usar en el bundle, a diferencia de
 * `signInWithPopup`: es una llamada HTTP a Firebase y no necesita el
 * popup/redirect resolver. Ese resolver es justo el que `firebase.ts` omite a
 * propósito, porque desde `capacitor://localhost` su iframe nunca contesta y
 * deja toda operación de Auth encolada para siempre, sin error ni timeout.
 *
 * ## Lo que NO se arregla desde acá
 *
 * El plugin trae código nativo: un pod, un esquema de URL en `Info.plist` y un
 * handler en `AppDelegate.swift`. Nada de eso viaja en el zip del OTA, que
 * lleva solo el bundle web. Este archivo sin el parche nativo compila, dibuja
 * el botón y falla al tocarlo.
 */
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "@/lib/mobile-env";

export type Plataforma = "ios" | "android" | "web";

/**
 * En qué plataforma corre esto.
 *
 * Es de runtime y no de build porque la misma build sirve a la web y al WebView
 * de Android: el shell de Android carga el Next desplegado en Cloud Run, así
 * que `IS_BUNDLED` ahí vale `false`. El puente de Capacitor se inyecta también
 * en modo remoto, así que `getPlatform()` contesta bien en los dos.
 *
 * Hace falta distinguir iOS de Android y no solo "nativo o no", porque los dos
 * necesitan credenciales distintas: ver `googleDisponibleEn`.
 */
export async function plataformaActual(): Promise<Plataforma> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const p = Capacitor.getPlatform();
    return p === "ios" || p === "android" ? p : "web";
  } catch {
    // En la web el paquete está igual; si el import falla, somos web.
    return "web";
  }
}

/**
 * Si el login nativo tiene con qué funcionar en esta plataforma.
 *
 * No es la misma condición en las dos, y tratarlas igual fue un error que
 * tuve acá: exigía el client ID de iOS también en Android.
 *
 * - **iOS** necesita los dos. El suyo lo identifica ante Google y su versión
 *   invertida es el esquema de URL del `Info.plist`; el web va como
 *   `iOSServerClientId`.
 * - **Android** necesita solo el web. No hay client ID de Android que pasarle
 *   al plugin: la app se identifica por su package name y la huella SHA-1 de
 *   la firma, que se registran en la consola y no viajan en el código. Pedirle
 *   el de iOS dejaba el botón escondido en Android para siempre, porque el
 *   deploy de la web no tiene por qué conocer un client ID de iOS.
 */
export function googleDisponibleEn(plataforma: Plataforma): boolean {
  if (plataforma === "ios") {
    return GOOGLE_IOS_CLIENT_ID !== "" && GOOGLE_WEB_CLIENT_ID !== "";
  }
  if (plataforma === "android") return GOOGLE_WEB_CLIENT_ID !== "";
  return false;
}

/**
 * `initialize` se llama una sola vez por vida del proceso.
 *
 * Se guarda la promesa y no un booleano: dos toques rápidos al botón entran acá
 * en paralelo, y con un booleano el segundo seguiría de largo antes de que el
 * primero termine de inicializar.
 */
let inicializacion: Promise<void> | null = null;

function inicializar(): Promise<void> {
  if (inicializacion) return inicializacion;
  inicializacion = (async () => {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({
      google: {
        // En Android queda vacío y el plugin no lo mira: lo que usa ahí es
        // `webClientId`.
        iOSClientId: GOOGLE_IOS_CLIENT_ID,
        // En Android el plugin necesita el cliente del SERVIDOR, que es el web.
        webClientId: GOOGLE_WEB_CLIENT_ID,
        // La doc del plugin pide que coincida con `webClientId`.
        iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
        // `online` devuelve el ID token directo. `offline` devuelve un
        // `serverAuthCode` para canjear en el backend, que es otro endpoint y
        // otro flujo: acá no hace falta porque no pedimos acceso offline a
        // ninguna API de Google.
        mode: "online",
      },
    });
  })();
  // Si falla, que el próximo intento pueda reintentar en vez de quedar pegado
  // a una promesa rechazada para siempre.
  inicializacion.catch(() => {
    inicializacion = null;
  });
  return inicializacion;
}

export class GoogleNativoError extends Error {
  constructor(message: string, readonly causa?: unknown) {
    super(message);
    this.name = "GoogleNativoError";
  }
}

/**
 * Abre el login nativo de Google y devuelve el ID token de Google.
 *
 * Quien lo llama tiene que convertirlo en sesión de Firebase; ver
 * `credencialDeGoogle()` en las páginas de login y alta.
 */
export async function pedirIdTokenDeGoogle(): Promise<string> {
  if (!googleDisponibleEn(await plataformaActual())) {
    throw new GoogleNativoError(
      "El login con Google no está configurado en este build.",
    );
  }

  await inicializar();
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  const respuesta = await SocialLogin.login({ provider: "google", options: {} });

  // En modo `online` el resultado trae `idToken`; el de modo `offline` trae
  // `serverAuthCode` y no sirve acá. El `in` distingue los dos sin castear.
  const resultado = respuesta.result;
  const idToken =
    resultado && "idToken" in resultado ? resultado.idToken : null;

  if (!idToken) {
    // Pasa cuando el usuario cancela la hoja nativa, y también cuando el
    // esquema de URL de `Info.plist` no coincide con el client ID: el flujo
    // vuelve sin token y sin error. Por eso el mensaje no promete cuál fue.
    throw new GoogleNativoError(
      "Google no devolvió una credencial. Probá de nuevo o entrá con tu correo.",
    );
  }
  return idToken;
}

/**
 * Cierra la sesión del plugin.
 *
 * Sin esto, el siguiente login reusa la cuenta que el sistema tiene cacheada y
 * el usuario no puede cambiar de cuenta: toca "Continuar con Google" y entra
 * con la de antes, sin que aparezca el selector.
 */
export async function cerrarSesionDeGoogle(): Promise<void> {
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.logout({ provider: "google" });
  } catch {
    // Que no haya sesión de Google que cerrar no es un error del logout de la
    // app: el que importa es el token propio, y ese ya se borró.
  }
}
