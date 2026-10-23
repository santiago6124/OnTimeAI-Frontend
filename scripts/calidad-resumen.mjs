#!/usr/bin/env node
/**
 * Resumen de calidad de un run de CI: cobertura, duplicación y código nuevo.
 *
 * Es el equivalente de `scripts/calidad_resumen.py` del Backend. Lee lo que
 * exista de `coverage/coverage-summary.json` (reporter `json-summary` de
 * vitest), `jscpd/jscpd-report.json` y `diff-cover.md`, y agrega una tabla en
 * markdown al archivo indicado (en CI, `$GITHUB_STEP_SUMMARY`). No falla si
 * falta un insumo: el gate lo ponen los pasos que los generan; esto sólo
 * informa.
 *
 *   node scripts/calidad-resumen.mjs --cobertura coverage/coverage-summary.json \
 *     --jscpd jscpd/jscpd-report.json --diff-cover diff-cover.md --salida resumen.md
 *
 * Ver CALIDAD.md.
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Los archivos chicos no dicen nada: sólo entran a "peor cubiertos" los de al
// menos esta cantidad de líneas ejecutables.
const LINEAS_MINIMAS = 50;

function leerJson(ruta) {
  return JSON.parse(readFileSync(ruta, "utf8"));
}

function pct(cubiertas, total) {
  return total ? Math.round((cubiertas / total) * 1000) / 10 : 0;
}

/**
 * Totales de líneas, ramas y funciones del `json-summary` de vitest, más los
 * archivos grandes peor cubiertos. Las claves del archivo son rutas absolutas;
 * se informan relativas a `raiz`.
 */
export function leerCobertura(ruta, raiz = process.cwd()) {
  if (!existsSync(ruta)) return null;
  const datos = leerJson(ruta);
  const t = datos.total ?? {};
  const archivos = [];
  for (const [archivo, m] of Object.entries(datos)) {
    if (archivo === "total") continue;
    const n = m.lines?.total ?? 0;
    if (n >= LINEAS_MINIMAS) {
      archivos.push([pct(m.lines.covered, n), relative(raiz, archivo).split("\\").join("/"), n]);
    }
  }
  archivos.sort(([pa, na], [pb, nb]) => pa - pb || na.localeCompare(nb));
  const li = t.lines ?? {};
  const ra = t.branches ?? {};
  const fn = t.functions ?? {};
  return {
    lineas_pct: pct(li.covered ?? 0, li.total ?? 0),
    lineas: li.total ?? 0,
    lineas_cubiertas: li.covered ?? 0,
    ramas_pct: pct(ra.covered ?? 0, ra.total ?? 0),
    ramas: ra.total ?? 0,
    ramas_cubiertas: ra.covered ?? 0,
    funciones_pct: pct(fn.covered ?? 0, fn.total ?? 0),
    funciones: fn.total ?? 0,
    funciones_cubiertas: fn.covered ?? 0,
    peor_cubiertos: archivos.slice(0, 5),
  };
}

/** Total del reporte JSON de jscpd. */
export function leerDuplicacion(ruta) {
  if (!existsSync(ruta)) return null;
  const t = leerJson(ruta).statistics.total;
  return {
    pct_lineas: t.percentage ?? 0,
    lineas_duplicadas: t.duplicatedLines ?? 0,
    lineas: t.lines ?? 0,
    clones: t.clones ?? 0,
    archivos: t.sources ?? 0,
  };
}

function celda(cob, clave) {
  return cob ? `${cob[`${clave}_pct`]} % (${cob[`${clave}_cubiertas`]}/${cob[clave]})` : "sin reporte";
}

export function markdown(cob, dup, diffMd) {
  const L = ["### Calidad del run", ""];
  L.push("| Cobertura de líneas | Cobertura de ramas | Cobertura de funciones | Duplicación (jscpd) |");
  L.push("|---|---|---|---|");
  const d = dup
    ? `${dup.pct_lineas} % (${dup.lineas_duplicadas}/${dup.lineas} líneas, ${dup.clones} clones)`
    : "sin reporte";
  L.push(`| ${celda(cob, "lineas")} | ${celda(cob, "ramas")} | ${celda(cob, "funciones")} | ${d} |`);
  if (cob?.peor_cubiertos.length) {
    L.push("", "Archivos grandes peor cubiertos:", "");
    for (const [p, nombre, n] of cob.peor_cubiertos) L.push(`- \`${nombre}\`: ${p} % de ${n} líneas`);
  }
  if (diffMd) {
    L.push("", "#### Cobertura sobre las líneas cambiadas", "", diffMd.trim());
  }
  L.push("");
  return L.join("\n");
}

const AYUDA = `uso: node scripts/calidad-resumen.mjs --salida <archivo.md> [--cobertura <json>] [--jscpd <json>] [--diff-cover <md>]

  --salida <md>       archivo al que se agrega el resumen (obligatorio)
  --cobertura <json>  json-summary de vitest (coverage/coverage-summary.json)
  --jscpd <json>      reporte de jscpd (jscpd/jscpd-report.json)
  --diff-cover <md>   reporte markdown de diff-cover (diff-cover.md)
`;

export function main(argv) {
  let args;
  try {
    ({ values: args } = parseArgs({
      args: argv,
      options: {
        cobertura: { type: "string", default: "coverage/coverage-summary.json" },
        jscpd: { type: "string", default: "jscpd/jscpd-report.json" },
        "diff-cover": { type: "string", default: "diff-cover.md" },
        salida: { type: "string" },
      },
    }));
  } catch (e) {
    console.error(e.message);
    console.error(AYUDA);
    return 2;
  }
  if (!args.salida) {
    console.error("falta --salida");
    console.error(AYUDA);
    return 2;
  }
  const cob = leerCobertura(resolve(args.cobertura));
  const dup = leerDuplicacion(resolve(args.jscpd));
  const diffMd = existsSync(args["diff-cover"]) ? readFileSync(args["diff-cover"], "utf8") : null;
  const texto = markdown(cob, dup, diffMd);
  appendFileSync(resolve(args.salida), texto);
  console.log(texto);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
