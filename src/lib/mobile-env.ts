/**
 * Banderas de build que separan la web del bundle móvil empaquetado.
 *
 * Las tres constantes son cadenas vacías o `false` cuando las variables no
 * están definidas, que es el caso de la web y del shell de Android en modo
 * remoto. Con eso, todo lo que las consulta rinde exactamente el mismo
 * comportamiento que antes: `API_BASE` queda en "/api/backend" (el BFF
 * same-origin) y las ramas nativas quedan muertas.
 *
 * Eso es lo que hace la migración verificable: sin variables, el diff es un
 * no-op comprobable con `pnpm build` de la web.
 *
 * Solo `scripts/build-mobile.mjs` las prende, y solo para el bundle de iOS.
 */

/** Este build sirve sus assets desde el binario (iOS), no desde un servidor. */
export const IS_BUNDLED = process.env.NEXT_PUBLIC_BUNDLED_APP === "1";

/**
 * Origen del FastAPI.
 *
 * En la web el navegador nunca habla con el backend directo: pega contra
 * `/api/backend/*`, que es un route handler same-origin que agrega el
 * `Authorization` leyendo la cookie HttpOnly. Esa cookie es el motivo de que el
 * token no sea alcanzable por JS.
 *
 * En el bundle nativo ese BFF no existe —los route handlers no se empaquetan— y
 * la cookie tampoco viajaría: el WebView corre sobre `capacitor://localhost`,
 * otro origen, y una cookie `SameSite=lax` no cruza. Ahí el teléfono le habla
 * al backend directo con el token en el header, guardado en almacenamiento
 * nativo (ver `lib/native/session.ts`).
 */
export const API_ORIGIN = normalizeOrigin(process.env.NEXT_PUBLIC_API_ORIGIN);

/**
 * Origen del propio Next desplegado.
 *
 * Distinto de `API_ORIGIN`: hay un route handler que el bundle todavía
 * necesita, `/api/weather`, porque agrega METARs de aviationweather.gov —que no
 * manda cabeceras CORS— y no puede llamarse desde el WebView. Ese sigue
 * corriendo en Cloud Run y el teléfono lo consume por HTTP.
 */
export const APP_ORIGIN = normalizeOrigin(process.env.NEXT_PUBLIC_APP_ORIGIN);

/**
 * Si "Evolución del modelo" (/reports) está disponible. Misma lógica que
 * REPORTS_ENABLED: la página es de servidor (getServerRole() lee cookies() y
 * searchParams la vuelve dinámica), el bundle la poda, y el menú tiene que
 * saberlo para no ofrecer un enlace que en el teléfono no lleva a ningún lado.
 * En la web siempre es true.
 */
export const REPORTS_ENABLED = process.env.NEXT_PUBLIC_DISABLE_REPORTS !== "1";

/**
 * Clientes OAuth del login con Google nativo.
 *
 * Son dos y no uno, y confundirlos es el error que hace que Android compile y
 * falle en el teléfono:
 *
 * - `GOOGLE_IOS_CLIENT_ID` identifica a la app de iOS ante Google. Su versión
 *   invertida es además el esquema de URL que va en `Info.plist`, y de eso se
 *   ocupa `scripts/ios-patch-google.sh`.
 * - `GOOGLE_WEB_CLIENT_ID` es el cliente de tipo *web*. En Android no hay
 *   client ID propio que pasarle al plugin: lo que necesita es el del
 *   servidor, que es el web. Y es también el `aud` que termina teniendo el ID
 *   token, o sea lo que el backend verifica.
 *
 * Vacíos mientras no existan las apps en la consola de Firebase, y con eso el
 * botón nativo no se dibuja. Es deliberado: un botón que no puede funcionar es
 * peor que no tener botón, que es exactamente el problema que tenía Android
 * antes de `useGoogleSignInDisponible`.
 */
export const GOOGLE_IOS_CLIENT_ID = (
  process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? ""
).trim();

export const GOOGLE_WEB_CLIENT_ID = (
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""
).trim();

/**
 * Qué se necesita de cada uno lo decide `googleDisponibleEn()` en
 * `lib/native/google-sign-in.ts`, porque depende de la plataforma y eso no se
 * sabe en tiempo de build: la misma build sirve a la web y al WebView de
 * Android.
 */

function normalizeOrigin(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

/**
 * Prefija una ruta de route handler con el origen del deploy.
 *
 * En la web `APP_ORIGIN` es "" y esto devuelve el mismo string que había antes,
 * carácter por carácter.
 */
export function appUrl(path: string): string {
  return `${APP_ORIGIN}${path}`;
}

/**
 * Ruta interna tal como la entiende el router de este build.
 *
 * El export estático se genera con `trailingSlash: true`, así que en el bundle
 * las navegaciones duras tienen que pedir "/login/" y no "/login": sin la barra
 * el router de assets de iOS no encuentra el `index.html` del directorio.
 * En la web la barra sobra y Next la normaliza, pero la mantenemos apagada para
 * que las URLs no cambien.
 */
export function appPath(path: string): string {
  if (!IS_BUNDLED) return path;
  const [pathname, query] = path.split("?");
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return query ? `${withSlash}?${query}` : withSlash;
}
