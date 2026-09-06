/**
 * Señal de "hay una pantalla real arriba".
 *
 * Dispara dos cosas que tienen que pasar juntas y una sola vez:
 *
 *  1. Bajar el splash. El arranque del bundle tiene varios saltos —el WebView
 *     carga el index, bootea React, y recién ahí la sesión resuelve si va al
 *     dashboard o al login—. Bajar el splash antes muestra blanco.
 *
 *  2. Confirmarle a Capgo que este bundle arrancó. Si no llega dentro de
 *     `appReadyTimeout` (10 s en `capacitor.config.ios.ts`), el plugin asume que
 *     el bundle nuevo rompió el arranque y revierte solo al anterior. Ese es el
 *     seguro que hace que un OTA malo no deje la app tapiada: para que sirva,
 *     esto tiene que llamarse cuando hay UI de verdad, no apenas corre el JS.
 */

let notified = false;

export async function notifyAppReady(): Promise<void> {
  if (notified) return;
  notified = true;

  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  // Capgo primero: es el que tiene ventana de tiempo. El splash puede esperar
  // unos milisegundos más; el rollback automático no.
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // Sin OTA configurado el plugin no está o falla: la app igual tiene que
    // arrancar. El bundle empaquetado no depende de Capgo para funcionar.
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    // `launchAutoHide` lo baja igual por temporizador.
  }
}
