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
      // cobertura sube, se suben al entero inmediatamente inferior al valor
      // medido. Línea de base del 2026-10-22 sobre origin/main: 17,6 % líneas,
      // 13,7 % ramas, 10,2 % funciones y 17,2 % sentencias. Ver CALIDAD.md.
      thresholds: {
        lines: 17,
        branches: 13,
        functions: 10,
        statements: 17,
      },
    },
  },
});
