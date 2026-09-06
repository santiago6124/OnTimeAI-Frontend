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
