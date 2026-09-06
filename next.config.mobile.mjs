/**
 * Config de Next para el bundle MÓVIL empaquetado (iOS).
 *
 * No reemplaza a `next.config.ts`: `scripts/build-mobile.mjs` la copia adentro
 * de `.mobile/` y compila ahí. La web y Android siguen con la config de la raíz
 * exactamente como está.
 *
 * Cada diferencia respecto de la web responde a una restricción concreta de
 * `output: 'export'`, documentada abajo.
 */

import { resolve } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Genera HTML/JS/CSS estáticos en `out/`, que es lo que se empaqueta en el
   * .ipa. Es incompatible con route handlers dinámicos, `cookies()`, `proxy.ts`
   * y rutas `[id]` sin `generateStaticParams` — por eso el script poda el árbol
   * antes de llegar acá.
   */
  output: "export",

  /**
   * Raíz de resolución de Turbopack.
   *
   * Es el repo, no `.mobile/`. Tiene que ser el repo porque `.mobile/node_modules`
   * es un symlink a los del repo —copiarlos serían cientos de MB por build— y
   * Turbopack rechaza los symlinks que apuntan fuera de su raíz con un
   * "points out of the filesystem root".
   *
   * Fijarla explícitamente además evita que Turbopack la infiera: sin lockfile
   * propio en `.mobile/`, la búsqueda sube igual hasta el repo, pero emite un
   * warning por raíz ambigua en cada build.
   *
   * Esto no mezcla los dos árboles: qué se compila lo decide el directorio de
   * trabajo (`.mobile/`), y `root` solo delimita hasta dónde se pueden resolver
   * módulos.
   */
  turbopack: {
    root: resolve(process.cwd(), ".."),
  },

  /**
   * Emite `/login/index.html` en vez de `/login.html`.
   *
   * Es lo que hace resoluble el árbol desde el sistema de archivos del
   * teléfono, donde no hay servidor que reescriba `/login` → `/login.html`.
   * El precio es que el router de assets de iOS hay que parchearlo
   * (`scripts/ios-patch-router.sh`): el de Capacitor manda toda ruta sin
   * extensión al index de la RAÍZ, y con un index por directorio eso devuelve
   * siempre la home.
   */
  trailingSlash: true,

  images: {
    /**
     * El optimizador de `next/image` necesita un servidor. En el bundle las
     * imágenes se sirven tal cual desde el binario.
     */
    unoptimized: true,
  },

  /**
   * `headers()` no existe en un export: no hay servidor que las mande. Las
   * cabeceras de seguridad de la web (CSP, X-Frame-Options, etc.) siguen
   * aplicando allá, donde el navegador es la superficie de ataque.
   *
   * En el bundle el equivalente lo da el sistema operativo: los assets salen de
   * `capacitor://localhost`, un origen que solo esta app puede servir, y no hay
   * terceros que puedan enmarcarla ni navegar hacia ella.
   */
};

export default nextConfig;
