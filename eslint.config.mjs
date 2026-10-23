import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Gate de complejidad ciclomática (McCabe): ninguna función de la app por
  // encima de 10. Las que ya lo superaban al instalar el gate están en
  // .complejidad-baseline.json y llevan un eslint-disable-next-line para que
  // `pnpm lint` pase; la marca no exime nada por sí sola, porque
  // scripts/complejidad.mjs corre con los comentarios apagados y compara contra
  // la baseline, que sólo puede achicarse. El mismo 10 vive en UMBRAL de ese
  // script. Ver COMPLEJIDAD.md.
  {
    files: ["src/**/*.{js,jsx,mjs,ts,tsx}"],
    rules: {
      complexity: ["error", 10],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Artefacto de build del bundle móvil: es una copia podada de src/, así que
    // linteala duplica cada hallazgo y encima reporta el archivo equivocado.
    ".mobile/**",

    // Reporte HTML de `pnpm test:cov` (reporter lcov de vitest): trae su propio
    // JS, que no es nuestro.
    "coverage/**",

    // Proyectos nativos generados por Capacitor. El JS que traen es de los
    // plugins, no del repo, y se regenera en cada `cap sync`.
    "android/**",
    "ios/**",
  ]),
]);

export default eslintConfig;
