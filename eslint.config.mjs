import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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

    // Proyectos nativos generados por Capacitor. El JS que traen es de los
    // plugins, no del repo, y se regenera en cada `cap sync`.
    "android/**",
    "ios/**",
  ]),
]);

export default eslintConfig;
