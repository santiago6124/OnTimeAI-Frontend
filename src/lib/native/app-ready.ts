/**
 * Dos señales del arranque nativo que conviene no confundir, porque tienen
 * ventanas de tiempo distintas:
 *
 *  1. `notifyAppReady()` — confirmarle al plugin de OTA que este bundle arrancó. Si no
 *     llega dentro de `appReadyTimeout` (10 s en `capacitor.config.ios.ts`),
 *     el plugin asume que el bundle nuevo rompió el arranque y revierte solo al
 *     anterior. Es el seguro contra un OTA malo, y lo que prueba es que el JS
 *     carga y React monta: eso es lo que un bundle roto no consigue. NO debe
 *     esperar a la sesión —`/auth/me` contra un Cloud Run frío puede tardar
 *     más que la ventana— porque entonces un backend lento se leería como un
 *     bundle roto y el plugin desharía un OTA sano en cada arranque en frío.
 *
 *  2. `hideSplash()` — bajar el splash. Acá sí hay que esperar: el arranque del
 *     bundle tiene varios saltos (el WebView carga el index, bootea React, y
 *     recién ahí la sesión resuelve si va al dashboard o al login). Bajarlo
 *     antes muestra blanco.
 *
 * Las dos corren una sola vez por arranque y son no-op fuera del nativo.
 */

let readyNotified = false;
let splashHidden = false;

export async function notifyAppReady(): Promise<void> {
  if (readyNotified) return;
  readyNotified = true;

  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // Sin OTA configurado el plugin no está o falla: la app igual tiene que
    // arrancar. El bundle empaquetado no depende del OTA para funcionar.
  }
}

export async function hideSplash(): Promise<void> {
  if (splashHidden) return;
  splashHidden = true;

  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    // `launchAutoHide` lo baja igual por temporizador.
  }
}
