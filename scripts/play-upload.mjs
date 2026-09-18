#!/usr/bin/env node
/**
 * Sube un AAB a una pista de Google Play.
 *
 *   node scripts/play-upload.mjs --aab ruta.aab --track internal \
 *        [--status completed|draft] [--name "1.0.0"] [--notes "texto"]
 *
 * Necesita un access token con scope androidpublisher en PLAY_ACCESS_TOKEN.
 * En CI lo da google-github-actions/auth por Workload Identity; en la Mac,
 *   gcloud auth print-access-token \
 *     --impersonate-service-account=play-publisher@ontimeai-prod.iam.gserviceaccount.com \
 *     --scopes=https://www.googleapis.com/auth/androidpublisher
 * (sin --scopes el token sale con cloud-platform y Play responde
 * "insufficient authentication scopes").
 *
 * Es la API de edits de Play, en cuatro pasos: abrir una edición, subir el
 * bundle, asignarlo a la pista y confirmar. Nada queda publicado hasta el
 * commit, así que un fallo a mitad de camino no deja nada a medias.
 *
 * Se escribió a mano y no con una action de terceros porque el token viene de
 * Workload Identity y no de una clave JSON: las actions más usadas exigen la
 * clave, y acá no queremos que exista una.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";

const PACKAGE = "com.ontimeai.app";
const API = "https://androidpublisher.googleapis.com";
const TRACKS = ["internal", "alpha", "beta", "production"];

const { values: args } = parseArgs({
  options: {
    aab: { type: "string" },
    track: { type: "string", default: "internal" },
    status: { type: "string", default: "completed" },
    name: { type: "string" },
    notes: { type: "string", default: "" },
  },
});

function fail(msg) {
  console.error(`play-upload: ${msg}`);
  process.exit(1);
}

if (!args.aab) fail("falta --aab");
if (!TRACKS.includes(args.track)) fail(`--track tiene que ser uno de ${TRACKS.join(", ")}`);
if (!["completed", "draft"].includes(args.status)) fail("--status tiene que ser completed o draft");
const token = process.env.PLAY_ACCESS_TOKEN;
if (!token) fail("falta PLAY_ACCESS_TOKEN");

const base = `${API}/androidpublisher/v3/applications/${PACKAGE}`;

async function call(method, url, body, contentType = "application/json") {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": contentType } : {}),
    },
    body: body && contentType === "application/json" ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Algunos errores vienen en HTML; se muestra el texto crudo abajo.
  }
  if (!res.ok) {
    const detail = json?.error?.message ?? text.slice(0, 500);
    throw new Error(`${method} ${url.replace(API, "")} → ${res.status}: ${detail}`);
  }
  return json;
}

const aab = await readFile(args.aab);
console.log(`AAB: ${basename(args.aab)} (${(aab.byteLength / 1024 / 1024).toFixed(1)} MB)`);

const edit = await call("POST", `${base}/edits`, {});
console.log(`Edición ${edit.id} abierta`);

try {
  const bundle = await call(
    "POST",
    `${API}/upload/androidpublisher/v3/applications/${PACKAGE}/edits/${edit.id}/bundles?uploadType=media`,
    aab,
    "application/octet-stream",
  );
  console.log(`Bundle subido: versionCode ${bundle.versionCode}`);

  const release = {
    versionCodes: [String(bundle.versionCode)],
    status: args.status,
    ...(args.name ? { name: args.name } : {}),
    ...(args.notes ? { releaseNotes: [{ language: "es-419", text: args.notes }] } : {}),
  };
  await call("PUT", `${base}/edits/${edit.id}/tracks/${args.track}`, {
    track: args.track,
    releases: [release],
  });
  console.log(`Pista ${args.track}: release ${args.status}`);

  await call("POST", `${base}/edits/${edit.id}:validate`, {});
  await call("POST", `${base}/edits/${edit.id}:commit`, {});
  console.log("Confirmado en Play Console.");
} catch (cause) {
  // Sin commit la edición expira sola, pero borrarla deja el estado limpio
  // para el próximo intento.
  await call("DELETE", `${base}/edits/${edit.id}`).catch(() => {});
  fail(cause.message);
}
