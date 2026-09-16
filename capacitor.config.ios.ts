import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * Config de Capacitor para iOS, con los assets EMPAQUETADOS.
 *
 * La CLI de Capacitor lee siempre `capacitor.config.ts` de la raíz y no acepta
 * un `--config`, así que el pipeline de iOS copia este archivo sobre aquél
 * dentro del checkout efímero de CI. En el repo los dos conviven intactos.
 *
 * La diferencia que importa es una sola: NO hay `server.url`. La app no carga
 * un sitio remoto en un WebView; sirve los archivos que vienen adentro del
 * .ipa, generados por `scripts/build-mobile.mjs`. Ese es el motivo de todo el
 * trabajo extra respecto de Android: App Review rechaza bajo Guideline 5.6 las
 * apps que son un shell apuntando a una URL. La app de Lia fue suspendida
 * exactamente así el 2026-07-30.
 *
 * Que los assets estén empaquetados no congela la UI. El Apple Developer
 * Program License Agreement §3.3.2 permite actualizar código interpretado
 * (JS/CSS/HTML) sin pasar por review, que es lo que hace el OTA (plugin de
 * Capgo contra un servidor propio, ver abajo). Y a
 * diferencia del modo remoto, si el servidor de OTA está caído la app sigue
 * andando con el bundle que ya tiene instalado.
 */
/**
 * Si el OTA está activo.
 *
 * Arranca APAGADO, y es deliberado: con `autoUpdate: true` el plugin consulta
 * el servidor de updates en cada arranque y, si no puede hablar con él, bloquea
 * el inicio contra un semáforo hasta que vence `appReadyTimeout` — diez
 * segundos de pantalla muerta. Un build de desarrollo no tiene por qué pagar
 * eso. `ios-release.yml` lo prende con el input `ota` (= `MOBILE_OTA=1`).
 *
 * El servidor es propio: `/api/ota/updates` en el Next desplegado en Cloud Run
 * (src/app/api/ota/updates/route.ts), con los bundles en un bucket de GCS que
 * escribe scripts/ota-publish.mjs. El plugin es el de Capgo (MPL-2.0), pero su
 * cloud no interviene: `updateUrl` es nuestro y las estadísticas van apagadas.
 */
const OTA = process.env.MOBILE_OTA === "1";

/**
 * A dónde pregunta el plugin. Por defecto el Next de producción; se pisa para
 * probar contra un servidor local expuesto por túnel. Sin OTA no se usa.
 */
const OTA_UPDATE_URL =
  (process.env.MOBILE_OTA_URL || "").trim() ||
  "https://ontimeai-frontend-871707213932.us-central1.run.app/api/ota/updates";

/**
 * Versión nativa que el plugin declara como punto de partida (`version_build`).
 * El servidor la compara con la del bundle que ofrece —no baja por debajo del
 * nativo, y respeta `min_native`— y exige semver estricto: el `1.0` que Xcode
 * pone por defecto no lo es.
 *
 * Viene de `MOBILE_APP_VERSION`, el mismo input `version` con el que
 * `ios-release.yml` fija `MARKETING_VERSION` en xcodebuild — una sola fuente
 * para el binario y para el OTA. Sin OTA no hace falta; con OTA es obligatoria,
 * y un valor inválido tiene que frenar acá y no en el teléfono.
 */
const APP_VERSION = (process.env.MOBILE_APP_VERSION || "").trim();
if (OTA && !/^\d+\.\d+\.\d+$/.test(APP_VERSION)) {
  throw new Error(
    `MOBILE_OTA=1 exige MOBILE_APP_VERSION en semver (ej. 1.0.0); recibí "${APP_VERSION}".`,
  );
}

/**
 * Canal fijado en el binario. Vacío en producción: el servidor usa
 * `production`. Un build de prueba que deba mirar `staging` se compila con
 * `MOBILE_OTA_CHANNEL=staging`; el plugin lo manda como `defaultChannel` y el
 * servidor rutea por eso. No hay registro de dispositivos ni asignación desde
 * una consola: el canal es una decisión de compilación.
 */
const OTA_CHANNEL = (process.env.MOBILE_OTA_CHANNEL || "").trim();

const config: CapacitorConfig = {
  appId: "com.ontimeai.app",
  appName: "OnTimeAI",

  // El export estático que arma scripts/build-mobile.mjs. Sin `server.url`,
  // esto SÍ es lo que se carga.
  webDir: ".mobile/out",

  plugins: {
    CapacitorUpdater: {
      autoUpdate: OTA,
      updateUrl: OTA_UPDATE_URL,
      // Sin esto el plugin reporta cada arranque al cloud de Capgo, que no
      // usamos. Vacío = no reportar. El log de /api/ota/updates en Cloud Run
      // es el registro de qué dispositivo pidió qué.
      statsUrl: "",
      // Viaja como `app_id` en cada consulta; el servidor lo verifica.
      appId: "com.ontimeai.app",
      ...(APP_VERSION ? { version: APP_VERSION } : {}),
      ...(OTA_CHANNEL ? { defaultChannel: OTA_CHANNEL } : {}),

      /**
       * Si la app no llama a `notifyAppReady()` dentro de esta ventana, el
       * plugin asume que el bundle nuevo rompió el arranque y vuelve solo al
       * anterior. Quien la llama es `NativeSessionGate` apenas React monta
       * (`lib/native/app-ready.ts`): eso ya prueba que el bundle carga, que es
       * lo único que un OTA malo no consigue. No espera a la sesión a
       * propósito — un backend frío que tarde más que esta ventana no es un
       * bundle roto, y no debe disparar un rollback.
       */
      appReadyTimeout: 10000,
    },

    SplashScreen: {
      /**
       * Más largo que en Android a propósito. Acá el arranque tiene varios
       * saltos encadenados: el WebView levanta el index del bundle, bootea
       * React, y recién entonces `NativeSessionGate` resuelve contra
       * `/auth/me` si va al dashboard o al login. Con los 2 s de Android el
       * splash puede vencer en el medio y mostrar blanco.
       *
       * Quien lo baja de verdad es la app cuando hay pantalla
       * (`lib/native/app-ready.ts`). Este temporizador queda solo como red de
       * seguridad: si el JS ni llega a ejecutarse, el splash tiene que irse
       * igual en vez de dejar la app aparentemente colgada.
       */
      launchShowDuration: 4000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    StatusBar: {
      style: "DARK",
      overlay: false,
      backgroundColor: "#0a0a0a",
    },

    Keyboard: {
      // `Native` hace que iOS achique el WebView cuando aparece el teclado, así
      // los layouts recalculan y el formulario de login sube en vez de quedar
      // tapado por el teclado.
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
  },

  ios: {
    /**
     * El viewport es `viewportFit: 'cover'`, así que el WebView ocupa la
     * pantalla completa y quien separa el contenido del notch y de la barra de
     * gestos es el CSS: las utilidades `.safe-top` / `.safe-bottom` de
     * globals.css, aplicadas en el header y en el contenido del shell.
     *
     * `never` evita que iOS agregue ADEMÁS su propio inset automático, que
     * padearía el contenido dos veces.
     *
     * Los dos lados van juntos: si alguien saca las utilidades del CSS, esto
     * deja el header debajo del reloj y la batería.
     */
    contentInset: "never",

    /**
     * Allowlist explícito de plugins que viajan en el .ipa.
     *
     * Es una allowlist, no una denylist: si agregás un plugin de Capacitor que
     * iOS deba usar, sumalo acá o no viaja en el binario. El workflow
     * `ios-release.yml` verifica que no se desincronice de package.json.
     */
    includePlugins: [
      "@capacitor/app",
      "@capacitor/keyboard",
      "@capacitor/preferences",
      "@capacitor/splash-screen",
      "@capacitor/status-bar",
      "@capgo/capacitor-updater",
    ],
  },
};

export default config;
