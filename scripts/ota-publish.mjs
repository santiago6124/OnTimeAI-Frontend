#!/usr/bin/env node
/**
 * Publica y administra los bundles OTA de iOS en el bucket propio.
 *
 * Es el reemplazo de la CLI de Capgo (`bundle upload`, `channel set`,
 * `bundle delete`). El plugin de la app pregunta a `/api/ota/updates`
 * (src/app/api/ota/updates/route.ts), y ese endpoint decide leyendo el
 * manifest que este script escribe. Toda la "base de datos" es un JSON:
 *
 *   {
 *     "channels": { "production": "1.0.1", "staging": null },
 *     "bundles":  { "1.0.1": { "url", "checksum", "min_native", ... } }
 *   }
 *
 *   node scripts/ota-publish.mjs upload --version 1.0.2 --channel staging \
 *        [--path .mobile/out] [--min-native 1.0.0] [--comment "qué cambia"]
 *   node scripts/ota-publish.mjs set --channel production --version 1.0.2
 *   node scripts/ota-publish.mjs set --channel staging --version none
 *   node scripts/ota-publish.mjs retire --version 1.0.2
 *   node scripts/ota-publish.mjs status
 *
 * Reglas que sostiene, porque el plugin las asume:
 *  - Una versión es inmutable. El plugin identifica el bundle por su versión:
 *    si ya bajó 1.0.2, no vuelve a bajar otro 1.0.2 con contenido distinto.
 *    Subir una versión existente falla, y `retire` avisa que no se reutilice.
 *  - El checksum es el SHA-256 del zip tal cual se descarga; el plugin lo
 *    verifica y descarta la descarga si no coincide.
 *  - El manifest se sube con `Cache-Control: no-cache`. Sin eso, GCS lo sirve
 *    con una hora de caché y un rollback tardaría una hora en regir.
 *
 * Necesita `gcloud` autenticado con permiso de escritura en el bucket, y `zip`.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const APP_ID = "com.ontimeai.app";
const BUCKET = process.env.OTA_BUCKET || "ontimeai-ota";
const PREFIX = process.env.OTA_PREFIX || "ios";
const CHANNELS = ["production", "staging"];
const SEMVER = /^\d+\.\d+\.\d+$/;

const gs = (name) => `gs://${BUCKET}/${PREFIX}/${name}`;
const publicUrl = (name) => `https://storage.googleapis.com/${BUCKET}/${PREFIX}/${name}`;

const log = (msg) => console.log(`[ota-publish] ${msg}`);

function fallar(msg) {
  console.error(`[ota-publish] ERROR: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Argumentos: `comando --clave valor ...`
// ---------------------------------------------------------------------------
const [comando, ...resto] = process.argv.slice(2);
const args = {};
for (let i = 0; i < resto.length; i++) {
  if (!resto[i].startsWith("--")) fallar(`argumento inesperado: ${resto[i]}`);
  args[resto[i].slice(2)] = resto[i + 1] ?? "";
  i++;
}

function requerir(nombre) {
  const v = (args[nombre] ?? "").trim();
  if (!v) fallar(`falta --${nombre}`);
  return v;
}

function version(nombre = "version") {
  const v = requerir(nombre);
  if (!SEMVER.test(v)) fallar(`--${nombre} tiene que ser semver de tres números (ej. 1.0.2); recibí "${v}"`);
  return v;
}

function canal() {
  const c = requerir("channel");
  if (!CHANNELS.includes(c)) fallar(`--channel tiene que ser uno de: ${CHANNELS.join(", ")}`);
  return c;
}

// ---------------------------------------------------------------------------
// gcloud
// ---------------------------------------------------------------------------
function gcloud(argv, { permitirFallo = false } = {}) {
  const r = spawnSync("gcloud", ["storage", ...argv], { encoding: "utf8" });
  if (r.error) fallar(`no se pudo ejecutar gcloud: ${r.error.message}`);
  if (r.status !== 0 && !permitirFallo) {
    fallar(`gcloud storage ${argv[0]} falló:\n${r.stderr.trim()}`);
  }
  return r;
}

function existe(uri) {
  return gcloud(["ls", uri], { permitirFallo: true }).status === 0;
}

function leerManifest() {
  const uri = gs("manifest.json");
  if (!existe(uri)) {
    log("no hay manifest todavía: se crea uno vacío");
    return {
      schema: 1,
      app_id: APP_ID,
      platform: "ios",
      channels: Object.fromEntries(CHANNELS.map((c) => [c, null])),
      bundles: {},
    };
  }
  const r = gcloud(["cat", uri]);
  let m;
  try {
    m = JSON.parse(r.stdout);
  } catch {
    fallar("el manifest del bucket no es JSON válido; arreglalo a mano antes de seguir");
  }
  if (m.app_id !== APP_ID) fallar(`el manifest es de otra app (${m.app_id})`);
  for (const c of CHANNELS) if (!(c in m.channels)) m.channels[c] = null;
  return m;
}

function escribirManifest(m) {
  const dir = mkdtempSync(join(tmpdir(), "ota-manifest-"));
  const local = join(dir, "manifest.json");
  writeFileSync(local, JSON.stringify(m, null, 2) + "\n");
  gcloud(["cp", "--cache-control=no-cache, max-age=0", local, gs("manifest.json")]);
  rmSync(dir, { recursive: true, force: true });
}

function sha256(archivo) {
  return createHash("sha256").update(readFileSync(archivo)).digest("hex");
}

function mostrar(m) {
  console.log("Canales:");
  for (const [c, v] of Object.entries(m.channels)) console.log(`  ${c.padEnd(12)} → ${v ?? "(sin bundle)"}`);
  console.log("Bundles:");
  const versiones = Object.keys(m.bundles).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  if (versiones.length === 0) console.log("  (ninguno)");
  for (const v of versiones) {
    const b = m.bundles[v];
    const extra = [b.min_native ? `nativo ≥ ${b.min_native}` : null, b.comment || null]
      .filter(Boolean)
      .join(" · ");
    console.log(`  ${v.padEnd(12)} ${b.uploaded_at?.slice(0, 10) ?? ""}  ${extra}`);
  }
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------
function upload() {
  const v = version();
  const c = canal();
  const ruta = resolve(args.path || ".mobile/out");
  const minNative = (args["min-native"] ?? "").trim();
  if (minNative && !SEMVER.test(minNative)) fallar(`--min-native no es semver: "${minNative}"`);
  if (!existsSync(join(ruta, "index.html"))) {
    fallar(`${ruta} no tiene index.html — ¿corriste scripts/build-mobile.mjs?`);
  }

  const m = leerManifest();
  if (m.bundles[v]) fallar(`la versión ${v} ya está publicada; las versiones son inmutables, subí la siguiente`);
  const zipUri = gs(`${v}.zip`);
  if (existe(zipUri)) fallar(`${zipUri} ya existe aunque no esté en el manifest; no se pisa, usá otra versión`);

  // El zip con los archivos en la raíz (index.html adentro directo). -X deja
  // afuera los atributos extendidos de macOS, que el plugin no necesita.
  const dir = mkdtempSync(join(tmpdir(), "ota-bundle-"));
  const zip = join(dir, `${v}.zip`);
  const z = spawnSync("zip", ["-r", "-X", "-q", zip, ".", "-x", ".DS_Store", "*/.DS_Store"], {
    cwd: ruta,
    encoding: "utf8",
  });
  if (z.status !== 0) fallar(`zip falló: ${z.stderr}`);
  const checksum = sha256(zip);
  const bytes = readFileSync(zip).length;
  log(`zip ${v}: ${(bytes / 1024 / 1024).toFixed(1)} MB, sha256 ${checksum.slice(0, 12)}…`);

  // Un zip por versión no cambia nunca: se puede cachear para siempre.
  gcloud(["cp", "--cache-control=public, max-age=31536000, immutable", zip, zipUri]);
  rmSync(dir, { recursive: true, force: true });

  m.bundles[v] = {
    url: publicUrl(`${v}.zip`),
    checksum,
    min_native: minNative || null,
    bytes,
    uploaded_at: new Date().toISOString(),
    comment: (args.comment ?? "").trim() || null,
  };
  const anterior = m.channels[c];
  m.channels[c] = v;
  escribirManifest(m);
  log(`publicado ${v} y canal ${c}: ${anterior ?? "(sin bundle)"} → ${v}`);
}

function set() {
  const c = canal();
  const raw = requerir("version");
  const v = raw === "none" ? null : version();
  const m = leerManifest();
  if (v && !m.bundles[v]) {
    fallar(`la versión ${v} no está publicada. Publicadas: ${Object.keys(m.bundles).join(", ") || "ninguna"}`);
  }
  const anterior = m.channels[c];
  if (anterior === v) {
    log(`el canal ${c} ya apunta a ${v ?? "(sin bundle)"}; nada que hacer`);
    return;
  }
  m.channels[c] = v;
  escribirManifest(m);
  log(`canal ${c}: ${anterior ?? "(sin bundle)"} → ${v ?? "(sin bundle)"}`);
}

function retire() {
  const v = version();
  const m = leerManifest();
  if (!m.bundles[v]) fallar(`la versión ${v} no está en el manifest`);
  const usada = Object.entries(m.channels).filter(([, x]) => x === v).map(([c]) => c);
  if (usada.length) fallar(`la versión ${v} sigue apuntada por: ${usada.join(", ")}. Movelos con 'set' primero`);
  delete m.bundles[v];
  escribirManifest(m);
  gcloud(["rm", gs(`${v}.zip`)], { permitirFallo: true });
  log(`retirada ${v}. No reutilices ese número: un dispositivo que ya la bajó no volvería a bajarla`);
}

function status() {
  mostrar(leerManifest());
  console.log(`\nManifest: ${publicUrl("manifest.json")}`);
}

const comandos = { upload, set, retire, status };
if (!comandos[comando]) {
  console.error(`Uso: node scripts/ota-publish.mjs <${Object.keys(comandos).join("|")}> [--opciones]`);
  process.exit(2);
}
comandos[comando]();
