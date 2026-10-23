#!/usr/bin/env node
/**
 * Gate y reporte de complejidad ciclomática del código de la app (`src/`).
 *
 * Es el equivalente de `scripts/complejidad.py` del Backend, con la regla
 * `complexity` de ESLint (McCabe) en lugar de ruff C901 y radon:
 *
 *  - Gate: ninguna función de `src/` puede superar UMBRAL decisiones, salvo las
 *    que ya lo superaban cuando se instaló el gate y figuran en
 *    `.complejidad-baseline.json`. Esa lista es un trinquete: una función
 *    exenta puede bajar o salir, pero no entrar una nueva ni crecer por encima
 *    del valor con el que entró. Las marcas `eslint-disable` del código se
 *    ignoran a propósito: el check compara contra la baseline, no contra los
 *    comentarios, así que agregar una marca a una función nueva no la exime.
 *  - Reporte: la misma regla con umbral 0 informa cada función con su valor,
 *    y de ahí salen el promedio, la distribución y el top 10 para el resumen
 *    del job y para seguir la evolución en el tiempo.
 *
 *   node scripts/complejidad.mjs --check                   # gate (CI y local)
 *   node scripts/complejidad.mjs --reporte complejidad.json # todas las funciones
 *   node scripts/complejidad.mjs --resumen resumen.md       # markdown (append)
 *   node scripts/complejidad.mjs --actualizar-baseline      # achica la lista exenta
 *
 * Clave de cada función en la baseline: `ruta relativa::nombre`, con el nombre
 * que ESLint pone en el mensaje ("Function 'CascadaCard'", "Async function
 * 'POST'", "Method 'x'"). Las funciones sin nombre (arrow functions, callbacks)
 * se identifican por tipo y línea: `ruta::arrow@L202`. Esa clave cambia si la
 * función se mueve de línea; el check la va a ver como nueva y hay que volver a
 * correr --actualizar-baseline (que la acepta sólo si la lista no crece).
 *
 * Ver COMPLEJIDAD.md para el porqué del umbral y del alcance.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ESLint } from "eslint";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Sólo el código de la app. `scripts/`, `mobile/` (reemplazos del bundle iOS,
// que se lintean cuando se copian a .mobile/) y los proyectos nativos quedan
// fuera: no corren en el servidor ni en el navegador del usuario.
const ALCANCE = ["src"];

// McCabe clásico: hasta 10 es una función simple; 11-20 moderada; más de 20
// compleja y difícil de probar exhaustivamente. El mismo valor va en la regla
// `complexity` de eslint.config.mjs, que es la que ve el editor y `pnpm lint`.
const UMBRAL = 10;

const BASELINE = join(RAIZ, ".complejidad-baseline.json");

// "Function 'CascadaCard' has a complexity of 32. Maximum allowed is 10."
const MENSAJE = /^(?<tipo>.+?)(?: '(?<nombre>.+)')? has a complexity of (?<cc>\d+)\. Maximum allowed is \d+\.$/;

// Rangos de radon, para que el reporte sea comparable con el del Backend.
const RANGOS = [
  [5, "A"],
  [10, "B"],
  [20, "C"],
  [30, "D"],
  [40, "E"],
];

function rango(cc) {
  for (const [tope, letra] of RANGOS) {
    if (cc <= tope) return letra;
  }
  return "F";
}

function fallar(msg) {
  console.error(`[complejidad] ERROR: ${msg}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Medición
// ---------------------------------------------------------------------------

/**
 * Corre ESLint sobre ALCANCE con la regla `complexity` en `umbral` y devuelve
 * una fila por función que lo supera. Con umbral 0 devuelve todas.
 *
 * `allowInlineConfig: false` apaga los comentarios `eslint-disable` del código;
 * `ruleFilter` deja correr sólo `complexity`, así que no importa qué otras
 * reglas tenga el proyecto ni si fallan.
 */
async function medir(umbral) {
  const eslint = new ESLint({
    cwd: RAIZ,
    allowInlineConfig: false,
    ruleFilter: ({ ruleId }) => ruleId === "complexity",
    overrideConfig: { rules: { complexity: ["error", umbral] } },
  });
  const resultados = await eslint.lintFiles(ALCANCE);
  const filas = [];
  for (const r of resultados) {
    const archivo = relative(RAIZ, r.filePath).split("\\").join("/");
    for (const m of r.messages) {
      if (m.fatal) {
        // Un archivo que no parsea no se mide: mejor cortar que informar menos.
        fallar(`${archivo}:${m.line}: ${m.message}`);
      }
      if (m.ruleId !== "complexity") continue;
      const g = MENSAJE.exec(m.message)?.groups;
      if (!g) fallar(`mensaje de ESLint inesperado: ${m.message}`);
      filas.push({
        archivo,
        linea: m.line,
        columna: m.column,
        tipo: g.tipo.toLowerCase(),
        nombre: g.nombre ?? null,
        cc: Number(g.cc),
      });
    }
  }
  filas.sort((a, b) => b.cc - a.cc || a.archivo.localeCompare(b.archivo) || a.linea - b.linea);
  return filas;
}

// "arrow function" → "arrow", "async arrow function" → "async-arrow",
// "function" → "function", "class field initializer" → "class-field-initializer".
function slugTipo(tipo) {
  const base = tipo !== "function" && tipo.endsWith(" function") ? tipo.slice(0, -" function".length) : tipo;
  return base.split(" ").join("-");
}

/** Claves `ruta::nombre` o `ruta::tipo@Llínea`; los nombres repetidos en un
 *  mismo archivo también llevan la línea para no pisarse. */
function conClaves(filas) {
  const vistos = new Map();
  for (const f of filas) {
    if (f.nombre) {
      const k = `${f.archivo}::${f.nombre}`;
      vistos.set(k, (vistos.get(k) ?? 0) + 1);
    }
  }
  return filas.map((f) => {
    let clave;
    if (f.nombre && vistos.get(`${f.archivo}::${f.nombre}`) === 1) {
      clave = `${f.archivo}::${f.nombre}`;
    } else if (f.nombre) {
      clave = `${f.archivo}::${f.nombre}@L${f.linea}`;
    } else {
      clave = `${f.archivo}::${slugTipo(f.tipo)}@L${f.linea}`;
    }
    return { ...f, clave };
  });
}

/** Funciones por encima del umbral, ignorando los `eslint-disable`: `{clave: cc}`. */
async function violaciones() {
  const actuales = {};
  for (const f of conClaves(await medir(UMBRAL))) {
    actuales[f.clave] = f.cc;
  }
  return actuales;
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

function cargarBaseline() {
  if (!existsSync(BASELINE)) return {};
  const datos = JSON.parse(readFileSync(BASELINE, "utf8"));
  if (datos.umbral !== UMBRAL) {
    fallar(
      `la baseline fue tomada con umbral ${datos.umbral} y el script usa ${UMBRAL}: ` +
        "regenerarla con --actualizar-baseline",
    );
  }
  return Object.fromEntries(Object.entries(datos.exentas ?? {}).map(([k, v]) => [k, Number(v)]));
}

function ordenar(exentas) {
  return Object.fromEntries(
    Object.entries(exentas).sort(([ka, va], [kb, vb]) => vb - va || ka.localeCompare(kb)),
  );
}

function guardarBaseline(exentas) {
  const datos = {
    _:
      "Funciones de src/ por encima del umbral cuando se instaló el gate. " +
      "Sólo puede achicarse: ver COMPLEJIDAD.md.",
    umbral: UMBRAL,
    exentas: ordenar(exentas),
  };
  writeFileSync(BASELINE, `${JSON.stringify(datos, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

async function check() {
  const actuales = await violaciones();
  const exentas = cargarBaseline();

  const nuevas = Object.entries(actuales).filter(([k]) => !(k in exentas));
  const crecieron = Object.entries(actuales)
    .filter(([k, v]) => k in exentas && v > exentas[k])
    .map(([k, v]) => [k, exentas[k], v]);
  const resueltas = Object.entries(exentas).filter(([k]) => !(k in actuales));

  const n = Object.keys(actuales).length;
  console.log(`umbral ${UMBRAL} · ${n} funciones por encima · ${Object.keys(exentas).length} exentas por baseline`);
  if (resueltas.length) {
    console.log("\nYa no superan el umbral (sacarlas de la baseline con --actualizar-baseline):");
    for (const [k, v] of resueltas.sort()) console.log(`  ✓ ${k}  (entró con ${v})`);
  }

  let fallo = false;
  if (nuevas.length) {
    fallo = true;
    console.log(`\n✗ ${nuevas.length} función(es) nueva(s) por encima de ${UMBRAL}:`);
    for (const [k, v] of nuevas.sort(([, a], [, b]) => b - a)) console.log(`  ${k}  CC=${v}`);
    console.log(`  Dividirla hasta bajar de ${UMBRAL}. La baseline no acepta entradas nuevas.`);
  }
  if (crecieron.length) {
    fallo = true;
    console.log(`\n✗ ${crecieron.length} función(es) exenta(s) que crecieron:`);
    for (const [k, antes, ahora] of crecieron.sort()) console.log(`  ${k}  ${antes} → ${ahora}`);
    console.log("  Una función exenta puede bajar, no subir.");
  }
  if (!fallo) console.log("\n✓ sin deuda nueva de complejidad");
  return fallo ? 1 : 0;
}

async function actualizarBaseline() {
  const actuales = await violaciones();
  if (existsSync(BASELINE)) {
    const previa = cargarBaseline();
    const bloquean = Object.entries(actuales)
      .filter(([k, v]) => !(k in previa) || v > previa[k])
      .sort(([a], [b]) => a.localeCompare(b));
    if (bloquean.length) {
      console.log("la baseline sólo puede achicarse; primero bajar la complejidad de:");
      for (const [k, v] of bloquean) console.log(`  ${k}  CC=${v}`);
      return 1;
    }
  }
  guardarBaseline(actuales);
  console.log(`baseline escrita con ${Object.keys(actuales).length} exentas en ${relative(RAIZ, BASELINE)}`);
  return 0;
}

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

async function reporte() {
  const bloques = (await medir(0)).map((f) => ({ ...f, rango: rango(f.cc) }));
  const total = bloques.length;
  const suma = bloques.reduce((acc, b) => acc + b.cc, 0);
  const porRango = {};
  for (const b of bloques) porRango[b.rango] = (porRango[b.rango] ?? 0) + 1;
  return {
    umbral: UMBRAL,
    alcance: ALCANCE,
    funciones: total,
    promedio: total ? Math.round((suma / total) * 100) / 100 : 0,
    por_rango: Object.fromEntries(Object.entries(porRango).sort()),
    sobre_umbral: bloques.filter((b) => b.cc > UMBRAL).length,
    sobre_20: bloques.filter((b) => b.cc > 20).length,
    detalle: bloques,
  };
}

function etiqueta(b) {
  return b.nombre ? `\`${b.nombre}\`` : `(${b.tipo})`;
}

function resumenMarkdown(rep, exentas) {
  const lineas = [
    "### Complejidad ciclomática (src/)",
    "",
    `| Funciones | Promedio | > ${UMBRAL} | > 20 | Exentas en baseline |`,
    "|---|---|---|---|---|",
    `| ${rep.funciones} | ${rep.promedio} | ${rep.sobre_umbral} | ${rep.sobre_20} | ${Object.keys(exentas).length} |`,
    "",
    `Por rango: ${Object.entries(rep.por_rango).map(([r, n]) => `${r}=${n}`).join(", ")}`,
    "",
    "| Función | CC | Archivo |",
    "|---|---|---|",
  ];
  for (const b of rep.detalle.slice(0, 10)) {
    lineas.push(`| ${etiqueta(b)} | ${b.cc} | \`${b.archivo}:${b.linea}\` |`);
  }
  lineas.push("");
  return lineas.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const AYUDA = `uso: node scripts/complejidad.mjs [--check] [--reporte salida.json] [--resumen archivo.md] [--actualizar-baseline]

  --check                gate: falla ante deuda nueva (código de salida 1)
  --reporte <json>       escribe el reporte de todas las funciones de src/
  --resumen <md>         agrega el resumen en markdown a ese archivo
  --actualizar-baseline  reescribe la baseline con las violaciones actuales (sólo puede achicarse)
`;

async function main() {
  let args;
  try {
    ({ values: args } = parseArgs({
      options: {
        check: { type: "boolean", default: false },
        reporte: { type: "string" },
        resumen: { type: "string" },
        "actualizar-baseline": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    }));
  } catch (e) {
    console.error(e.message);
    console.error(AYUDA);
    return 2;
  }
  const algo = args.check || args.reporte || args.resumen || args["actualizar-baseline"];
  if (args.help || !algo) {
    console.log(AYUDA);
    return 0;
  }

  let codigo = 0;
  if (args["actualizar-baseline"]) {
    codigo = await actualizarBaseline();
    if (codigo) return codigo;
  }
  if (args.check) codigo = await check();
  if (args.reporte || args.resumen) {
    const rep = await reporte();
    if (args.reporte) {
      writeFileSync(resolve(args.reporte), `${JSON.stringify(rep, null, 2)}\n`);
      console.log(`reporte en ${args.reporte} (${rep.funciones} funciones, promedio ${rep.promedio})`);
    }
    if (args.resumen) {
      appendFileSync(resolve(args.resumen), resumenMarkdown(rep, cargarBaseline()));
    }
  }
  return codigo;
}

process.exitCode = await main();
