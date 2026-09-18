#!/usr/bin/env node
/**
 * Carga la ficha de Google Play desde store/android/: textos, ícono, gráfico
 * destacado y capturas de teléfono. Idempotente: cada corrida reemplaza todo.
 *
 *   PLAY_ACCESS_TOKEN=$(gcloud auth print-access-token \
 *       --impersonate-service-account=play-publisher@ontimeai-prod.iam.gserviceaccount.com \
 *       --scopes=https://www.googleapis.com/auth/androidpublisher) \
 *   node scripts/play-listing.mjs [--dry-run]
 *
 * Lo que NO se puede hacer por API y queda en la consola: Data safety,
 * clasificación de contenido, público objetivo, "app access" (credenciales
 * del revisor) y la URL de la política de privacidad. Están en
 * PUBLICACION.md §03.
 *
 * Los textos viven en store/android/listing.<idioma>.json y son los mismos
 * que muestra PUBLICACION.md §02; si se cambia uno, se cambia el otro.
 */
import { readFile, readdir } from "node:fs/promises";
import { parseArgs } from "node:util";

const PACKAGE = "com.ontimeai.app";
const API = "https://androidpublisher.googleapis.com";
const DIR = "store/android";

const { values: args } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
const token = process.env.PLAY_ACCESS_TOKEN;
if (!token) {
  console.error("play-listing: falta PLAY_ACCESS_TOKEN");
  process.exit(1);
}

const base = `${API}/androidpublisher/v3/applications/${PACKAGE}`;

async function call(method, url, body, contentType = "application/json") {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": contentType } : {}) },
    body: body && contentType === "application/json" ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // errores en HTML: se muestra el texto crudo
  }
  if (!res.ok) {
    throw new Error(`${method} ${url.replace(API, "")} → ${res.status}: ${json?.error?.message ?? text.slice(0, 400)}`);
  }
  return json;
}

const listings = [];
for (const f of (await readdir(DIR)).filter((n) => /^listing\.[a-z]{2}(-[A-Za-z0-9]+)?\.json$/.test(n))) {
  listings.push(JSON.parse(await readFile(`${DIR}/${f}`, "utf8")));
}
if (listings.length === 0) throw new Error(`no hay listing.*.json en ${DIR}`);
const defaultListing = listings[0];

const screenshots = (await readdir(`${DIR}/screenshots`)).filter((n) => n.endsWith(".png")).sort();
console.log(`Idiomas: ${listings.map((l) => l.language).join(", ")} · capturas: ${screenshots.length}`);
if (args["dry-run"]) process.exit(0);

const edit = await call("POST", `${base}/edits`, {});
console.log(`Edición ${edit.id} abierta`);

try {
  await call("PATCH", `${base}/edits/${edit.id}/details`, {
    defaultLanguage: defaultListing.language,
    contactEmail: defaultListing.contactEmail,
    contactWebsite: defaultListing.contactWebsite,
  });
  console.log(`Detalles: idioma ${defaultListing.language}, contacto ${defaultListing.contactEmail}`);

  for (const l of listings) {
    await call("PUT", `${base}/edits/${edit.id}/listings/${l.language}`, {
      language: l.language,
      title: l.title,
      shortDescription: l.shortDescription,
      fullDescription: l.fullDescription,
    });
    console.log(`Ficha ${l.language}: "${l.title}" (${l.shortDescription.length}/80, ${l.fullDescription.length}/4000)`);

    const images = `${base}/edits/${edit.id}/listings/${l.language}`;
    const upload = `${API}/upload/androidpublisher/v3/applications/${PACKAGE}/edits/${edit.id}/listings/${l.language}`;

    for (const [type, file] of [
      ["icon", `${DIR}/icon-512.png`],
      ["featureGraphic", `${DIR}/feature-1024x500.png`],
    ]) {
      await call("DELETE", `${images}/${type}`);
      await call("POST", `${upload}/${type}?uploadType=media`, await readFile(file), "image/png");
      console.log(`  ${type} ← ${file}`);
    }

    await call("DELETE", `${images}/phoneScreenshots`);
    for (const shot of screenshots) {
      await call("POST", `${upload}/phoneScreenshots?uploadType=media`, await readFile(`${DIR}/screenshots/${shot}`), "image/png");
      console.log(`  phoneScreenshots ← ${shot}`);
    }
  }

  await call("POST", `${base}/edits/${edit.id}:validate`, {});
  await call("POST", `${base}/edits/${edit.id}:commit`, {});
  console.log("Ficha confirmada en Play Console.");
} catch (cause) {
  await call("DELETE", `${base}/edits/${edit.id}`).catch(() => {});
  console.error(`play-listing: ${cause.message}`);
  process.exit(1);
}
