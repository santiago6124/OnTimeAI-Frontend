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
 * (JS/CSS/HTML) sin pasar por review, que es de lo que se ocupa Capgo. Y a
 * diferencia del modo remoto, si el servidor de OTA está caído la app sigue
 * andando con el bundle que ya tiene instalado.
 */
/**
 * Si el OTA de Capgo está activo.
 *
 * Arranca APAGADO, y es deliberado. Con `autoUpdate: true` y sin cuenta de
 * Capgo configurada, el plugin consulta su cloud en cada arranque, cobra un
 * `429 (on_premise_app)` y bloquea el inicio contra un semáforo hasta que
 * vence `appReadyTimeout` — o sea, diez segundos de pantalla muerta a cambio de
 * nada, porque no hay ningún bundle que pueda bajar.
 *
 * El plugin igual viaja en el binario y `notifyAppReady()` ya está cableado
 * (`lib/native/app-ready.ts`), así que prender el OTA cuando exista la cuenta
 * es una variable de entorno: `MOBILE_CAPGO=1`. No hay que recompilar nada
 * más ni tocar código.
 */
const CAPGO_OTA = process.env.MOBILE_CAPGO === "1";

const config: CapacitorConfig = {
  appId: "com.ontimeai.app",
  appName: "OnTimeAI",

  // El export estático que arma scripts/build-mobile.mjs. Sin `server.url`,
  // esto SÍ es lo que se carga.
  webDir: ".mobile/out",

  plugins: {
    CapacitorUpdater: {
      autoUpdate: CAPGO_OTA,
      defaultChannel: "production",

      /**
       * Si la app no llama a `notifyAppReady()` dentro de esta ventana, el
       * plugin asume que el bundle nuevo rompió el arranque y vuelve solo al
       * anterior. Quien la llama es `CapacitorBootstrap`, atado a la misma
       * señal que baja el splash — o sea, recién cuando hay una pantalla real
       * arriba (`lib/native/app-ready.ts`). Un bundle que crashea antes de eso
       * se revierte sin que nadie intervenga.
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
     * El layout padea con `env(safe-area-inset-*)` y el viewport es
     * `viewportFit: 'cover'`. Si además iOS metiera su propio inset
     * automático, el contenido quedaría padeado dos veces bajo el notch.
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
