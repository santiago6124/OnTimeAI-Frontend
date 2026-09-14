import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Config de Capacitor para ANDROID, en modo remoto.
 *
 * El shell nativo no lleva assets propios: abre un WebView contra el Next
 * desplegado en Cloud Run. Es la variante más simple que existe y no cuesta
 * nada de mantenimiento — un deploy de la web actualiza la app sin recompilar,
 * y no hay que reimplementar auth ni el BFF, porque adentro del WebView el
 * origen es el mismo sitio de siempre: la cookie `HttpOnly` viaja, el proxy
 * `/api/backend/*` funciona y `proxy.ts` sigue guardando las rutas.
 *
 * Lo que se paga: sin conexión la app no bootea, porque no tiene nada que
 * mostrar. Y la URL es una dependencia dura — si el service de Cloud Run cambia
 * de host, la app instalada queda apuntando a un sitio muerto. Por eso el valor
 * sale de `CAP_SERVER_URL`: cambiar de dominio es una línea.
 *
 * iOS NO puede usar esto: la app de Lia fue suspendida bajo Guideline 5.6 justo
 * por este patrón. Su config es `capacitor.config.ios.ts`, con los assets
 * empaquetados. Ver MOBILE_APP.md §2.
 *
 * Si algún día Play Store objeta lo mismo, el bundle de iOS ya existe y Android
 * puede consumirlo: ver MOBILE_APP.md §7.
 */
const SERVER_URL_DEFECTO =
  "https://ontimeai-frontend-871707213932.us-central1.run.app";

/**
 * URL que abre el WebView.
 *
 * El `||` no es intercambiable con `??` acá, y la diferencia rompió el primer
 * build en CI. Un `workflow_dispatch` con el input vacío exporta
 * `CAP_SERVER_URL=""` —una cadena vacía, no una variable ausente—, y `??` solo
 * cae al default con `null` o `undefined`. El resultado era `new URL("")`, que
 * tira `Invalid URL` y hace fallar el `cap sync` entero.
 */
const SERVER_URL = (process.env.CAP_SERVER_URL || "").trim() || SERVER_URL_DEFECTO;

let host: string;
try {
  host = new URL(SERVER_URL).host;
} catch {
  // Un valor mal formado tiene que decir qué pasó: el error de `new URL` es un
  // stack trace de la CLI de Capacitor que no menciona la variable.
  throw new Error(
    `CAP_SERVER_URL no es una URL válida: "${SERVER_URL}". ` +
      `Esperaba algo como ${SERVER_URL_DEFECTO}`,
  );
}

const config: CapacitorConfig = {
  appId: "com.ontimeai.app",
  appName: "OnTimeAI",

  /**
   * Capacitor exige un `webDir` con un index.html aunque en modo remoto no
   * sirva ninguno de esos archivos. `mobile/shell/` existe solo para satisfacer
   * a la CLI; deliberadamente NO es `public/`, para que nada de lo que hay ahí
   * pueda terminar adentro del APK sin que alguien lo decida.
   */
  webDir: "mobile/shell",

  server: {
    url: SERVER_URL,
    // El WebView tiene que poder volver al sitio después de un redirect del
    // login. Sin esto, Capacitor abriría el navegador del sistema.
    allowNavigation: [host],
  },

  plugins: {
    SplashScreen: {
      // Modo remoto: lo que tarda es la red, no el JS. 2 s cubre un arranque
      // normal; si la red está lenta el WebView ya muestra su propio progreso,
      // y dejar el splash más tiempo solo esconde que la app está esperando.
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
    StatusBar: {
      // La app arranca en tema oscuro (`defaultTheme="dark"` en el layout).
      style: "DARK",
      backgroundColor: "#0a0a0a",
    },
    CapacitorUpdater: {
      // El plugin viaja igual porque Capacitor lo instala para las dos
      // plataformas, pero Android NO hace OTA: sus assets son remotos, así que
      // un deploy de la web ya es la actualización. Dejarlo prendido acá haría
      // que el plugin intente pisar un `webDir` que no se usa.
      autoUpdate: false,
    },
  },

  android: {
    // Los `.txt` del payload RSC y los assets de Next ya vienen comprimidos por
    // la red; no hay nada local que mezclar.
    webContentsDebuggingEnabled: false,
  },
};

export default config;
