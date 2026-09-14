/**
 * Token de sesión en el bundle nativo.
 *
 * En la web el token vive en una cookie `HttpOnly` que JS no puede leer, y el
 * BFF `/api/backend/*` es quien la traduce a un header `Authorization`. Ese
 * diseño no sobrevive al empaquetado: el WebView corre sobre
 * `capacitor://localhost`, el BFF no viaja en el binario, y una cookie
 * `SameSite=lax` puesta por el backend en otro origen no se manda.
 *
 * Acá el token lo guarda el propio JS en `@capacitor/preferences`, que en iOS
 * escribe en `UserDefaults` del contenedor de la app —almacenamiento privado
 * del proceso, no compartido con otras apps ni legible desde el WebView de
 * otra— y sobrevive a cerrar la app.
 *
 * Es una superficie de exposición mayor que la cookie `HttpOnly` de la web: acá
 * el token SÍ es alcanzable por el JS que corre en el WebView. Es la
 * consecuencia inevitable de sacar el servidor del medio, y el motivo de que la
 * web no cambie: sigue con la cookie.
 *
 * `@capacitor/preferences` se importa con `import()` dinámico a propósito. Este
 * módulo lo alcanzan builds que no son nativos (el árbol de tipos de la web),
 * y una importación estática metería el plugin en el bundle del navegador.
 */

const TOKEN_KEY = "ontimeai.auth.token";

/**
 * Cache en memoria del token.
 *
 * `undefined` = todavía no se leyó del almacenamiento; `null` = se leyó y no
 * hay sesión. La distinción importa: sin ella, cada request pagaría un salto al
 * puente nativo, que es asíncrono y en el arranque compite con el primer render.
 */
let cached: string | null | undefined;

/**
 * OJO — el plugin NO se puede devolver desde una función async ni pasar por un
 * `await`, y esa restricción no es un detalle de estilo.
 *
 * `Preferences` es un Proxy que convierte el acceso a CUALQUIER propiedad en
 * una llamada al plugin nativo. Cuando una promesa adopta un valor, lo primero
 * que hace es leerle `.then` para ver si es un thenable: el Proxy contesta con
 * una función, la maquinaria de promesas la llama creyendo que encadena, y la
 * llamada viaja al puente como un método "then" que no existe.
 *
 * El síntoma es peor que un error: además de tirar
 * `"Preferences.then()" is not implemented`, la promesa queda sin resolver
 * nunca. Una app que arranca contra esto se queda en la pantalla de carga para
 * siempre, sin nada que lo explique.
 *
 * Por eso el import va adentro de cada función y el plugin se usa en el lugar:
 * lo que se awaitea es `Preferences.get(...)`, que sí devuelve una promesa de
 * verdad, y nunca `Preferences`.
 */

/** Token actual, leyéndolo del almacenamiento nativo la primera vez. */
export async function loadToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    cached = value ?? null;
  } catch {
    // Sin puente nativo (por ejemplo, el bundle abierto en un navegador de
    // escritorio para depurar) no hay sesión persistida, no un error fatal.
    cached = null;
  }
  return cached;
}

export async function saveToken(token: string): Promise<void> {
  cached = token;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: TOKEN_KEY, value: token });
  } catch {
    // El token queda en memoria: la sesión anda hasta cerrar la app.
  }
}

export async function clearToken(): Promise<void> {
  cached = null;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key: TOKEN_KEY });
  } catch {
    // Ya está limpio en memoria, que es lo que corta la sesión en curso.
  }
}
