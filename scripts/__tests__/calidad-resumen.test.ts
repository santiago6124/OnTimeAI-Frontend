/** scripts/calidad-resumen.mjs: el resumen refleja los insumos y tolera que falten. */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { leerCobertura, leerDuplicacion, main, markdown } from "../calidad-resumen.mjs";

type Medida = { total: number; covered: number; skipped: number; pct: number };

function medida(total: number, covered: number): Medida {
  return { total, covered, skipped: 0, pct: total ? (covered / total) * 100 : 100 };
}

function archivo(lines: Medida) {
  return { lines, statements: lines, functions: medida(0, 0), branches: medida(0, 0) };
}

const DUP = {
  statistics: {
    total: { lines: 26399, duplicatedLines: 334, percentage: 1.27, clones: 23, sources: 228 },
  },
};

function fixtures() {
  const dir = mkdtempSync(join(tmpdir(), "calidad-resumen-"));
  const resumen = {
    total: {
      lines: medida(2534, 446),
      statements: medida(2846, 490),
      functions: medida(900, 92),
      branches: medida(2633, 361),
    },
    [join(dir, "src/lib/grande.ts")]: archivo(medida(60, 12)),
    [join(dir, "src/lib/mediano.ts")]: archivo(medida(50, 50)),
    [join(dir, "src/lib/chico.ts")]: archivo(medida(10, 0)),
  };
  writeFileSync(join(dir, "coverage-summary.json"), JSON.stringify(resumen));
  writeFileSync(join(dir, "jscpd-report.json"), JSON.stringify(DUP));
  writeFileSync(join(dir, "diff-cover.md"), "| Diff | 90 % |\n");
  return dir;
}

describe("leerCobertura", () => {
  it("devuelve null si no hay reporte", () => {
    expect(leerCobertura("/no/existe/coverage-summary.json")).toBeNull();
  });

  it("toma los totales y sólo los archivos con al menos 50 líneas, del peor al mejor", () => {
    const dir = fixtures();
    const cob = leerCobertura(join(dir, "coverage-summary.json"), dir);
    expect(cob).toMatchObject({
      lineas_pct: 17.6,
      lineas: 2534,
      lineas_cubiertas: 446,
      ramas_pct: 13.7,
      ramas: 2633,
      ramas_cubiertas: 361,
      funciones_pct: 10.2,
      funciones: 900,
      funciones_cubiertas: 92,
    });
    expect(cob?.peor_cubiertos).toEqual([
      [20, "src/lib/grande.ts", 60],
      [100, "src/lib/mediano.ts", 50],
    ]);
  });

  it("no explota con un reporte sin total", () => {
    const dir = mkdtempSync(join(tmpdir(), "calidad-resumen-"));
    writeFileSync(join(dir, "c.json"), "{}");
    const cob = leerCobertura(join(dir, "c.json"), dir);
    expect(cob).toMatchObject({ lineas_pct: 0, lineas: 0, ramas_pct: 0, funciones_pct: 0, peor_cubiertos: [] });
  });
});

describe("leerDuplicacion", () => {
  it("devuelve null si no hay reporte", () => {
    expect(leerDuplicacion("/no/existe/jscpd-report.json")).toBeNull();
  });

  it("lee el total de jscpd", () => {
    const dir = fixtures();
    expect(leerDuplicacion(join(dir, "jscpd-report.json"))).toEqual({
      pct_lineas: 1.27,
      lineas_duplicadas: 334,
      lineas: 26399,
      clones: 23,
      archivos: 228,
    });
  });
});

describe("markdown", () => {
  it("arma la tabla, los peor cubiertos y el bloque de diff-cover", () => {
    const dir = fixtures();
    const cob = leerCobertura(join(dir, "coverage-summary.json"), dir);
    const dup = leerDuplicacion(join(dir, "jscpd-report.json"));
    const md = markdown(cob, dup, "| Diff | 90 % |\n");
    expect(md).toContain("### Calidad del run");
    expect(md).toContain(
      "| 17.6 % (446/2534) | 13.7 % (361/2633) | 10.2 % (92/900) | 1.27 % (334/26399 líneas, 23 clones) |",
    );
    expect(md).toContain("- `src/lib/grande.ts`: 20 % de 60 líneas");
    expect(md).toContain("#### Cobertura sobre las líneas cambiadas\n\n| Diff | 90 % |");
    expect(md.endsWith("\n")).toBe(true);
  });

  it("sin insumos informa 'sin reporte' y omite las secciones opcionales", () => {
    const md = markdown(null, null, null);
    expect(md).toContain("| sin reporte | sin reporte | sin reporte | sin reporte |");
    expect(md).not.toContain("peor cubiertos");
    expect(md).not.toContain("líneas cambiadas");
  });
});

describe("main", () => {
  afterEach(() => vi.restoreAllMocks());

  it("agrega el resumen al archivo de salida y lo imprime", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const dir = fixtures();
    const salida = join(dir, "resumen.md");
    writeFileSync(salida, "previo\n");
    const args = [
      "--cobertura", join(dir, "coverage-summary.json"),
      "--jscpd", join(dir, "jscpd-report.json"),
      "--diff-cover", join(dir, "diff-cover.md"),
      "--salida", salida,
    ];
    expect(main(args)).toBe(0);
    expect(main(args)).toBe(0);
    const texto = readFileSync(salida, "utf8");
    expect(texto.startsWith("previo\n### Calidad del run")).toBe(true);
    expect(texto.match(/### Calidad del run/g)).toHaveLength(2);
    expect(texto).toContain("| Diff | 90 % |");
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("con insumos inexistentes igual escribe la tabla", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const dir = mkdtempSync(join(tmpdir(), "calidad-resumen-"));
    const salida = join(dir, "resumen.md");
    expect(main(["--cobertura", join(dir, "no.json"), "--jscpd", join(dir, "no.json"), "--diff-cover", join(dir, "no.md"), "--salida", salida])).toBe(0);
    expect(readFileSync(salida, "utf8")).toContain("| sin reporte | sin reporte | sin reporte | sin reporte |");
  });

  it("sin --salida o con una opción desconocida devuelve 2 y muestra la ayuda", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(main([])).toBe(2);
    expect(main(["--loquesea"])).toBe(2);
    expect(error.mock.calls.flat().join("\n")).toContain("uso: node scripts/calidad-resumen.mjs");
  });
});
