import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      // Mismo alcance que el gate de complejidad: sólo el código de la app.
      include: ["src/**"],
      exclude: ["src/**/__tests__/**", "src/**/*.d.ts"],
      reporter: ["text-summary", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      // Trinquete: el total no puede bajar de estos valores, y cuando la
      // cobertura sube, se suben. Línea de base medida el 2026-10-22 sobre
      // origin/main: 17,6 % líneas, 13,7 % ramas, 10,2 % funciones y 17,2 %
      // sentencias. Estos valores están UN PUNTO POR ENCIMA a propósito: el
      // primer run del CI tiene que fallar acá, como evidencia de que el
      // trinquete corta. El commit siguiente los deja en el entero
      // inmediatamente inferior a la línea de base (17, 13, 10 y 17). Ver
      // CALIDAD.md.
      thresholds: {
        lines: 18,
        branches: 14,
        functions: 11,
        statements: 18,
      },
    },
  },
});
