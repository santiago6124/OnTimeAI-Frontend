/**
 * Canales públicos de contacto del proyecto. Los leen la política de
 * privacidad y la página de soporte, que las dos tiendas exigen publicadas y
 * accesibles sin sesión.
 *
 * Están en un solo lugar para que cambiar el canal —otro correo, otro repo—
 * sea una línea y no una búsqueda.
 */

/** Repositorio público del frontend; las issues son el canal de soporte. */
export const REPO_URL = "https://github.com/santiago6124/OnTimeAI-Frontend";

export const ISSUES_URL = `${REPO_URL}/issues`;

/** Fecha de la última revisión de la política de privacidad (ISO). */
export const PRIVACIDAD_ACTUALIZADA = "2026-09-18";
