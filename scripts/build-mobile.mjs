#!/usr/bin/env node
/**
 * Arma el bundle web de la app MÓVIL empaquetada (iOS).
 *
 * El problema: este repo es una app Next con cuatro route handlers, un
 * `proxy.ts` que guarda las rutas y varias páginas que leen la cookie de sesión
 * en el servidor. `output: 'export'` no convive con nada de eso, y la app móvil
 * tampoco lo necesita: los handlers se quedan corriendo en Cloud Run y el
 * teléfono los consume por HTTP.
 *
 * La solución es no tocar el árbol del repo. Este script copia un subconjunto a
 * `.mobile/`, lo poda, le pone un config y unas páginas propias, y corre el
 * build ahí. `src/`, `next.config.ts` y `proxy.ts` quedan exactamente como
 * están para la web y para Android.
 *
 *   node scripts/build-mobile.mjs              # prepara el árbol y compila
 *   node scripts/build-mobile.mjs --prepare    # solo prepara (para depurar)
 *   node scripts/build-mobile.mjs --strict     # falla si falta alguna variable
 *
 * Salida: `.mobile/out/` — lo que después consume Capacitor como `webDir`.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = join(ROOT, ".mobile");
const OUT = join(BUILD, "out");

const args = new Set(process.argv.slice(2));
const PREPARE_ONLY = args.has("--prepare");
const STRICT = args.has("--strict");

/**
 * Origen del FastAPI. El bundle le habla directo con `Authorization: Bearer`,
 * porque no lleva el BFF adentro. Requiere que el backend liste
 * `capacitor://localhost` en ALLOWED_ORIGINS.
 */
const API_ORIGIN =
  process.env.MOBILE_API_ORIGIN ??
  "https://ontimeai-backend-871707213932.us-central1.run.app";

/**
 * Origen del propio Next desplegado. Solo se usa para `/api/weather`, el único
 * route handler que el bundle sigue consumiendo (agrega METARs de
 * aviationweather.gov, que no manda cabeceras CORS).
 */
const APP_ORIGIN =
  process.env.MOBILE_APP_ORIGIN ??
  "https://ontimeai-frontend-871707213932.us-central1.run.app";

/**
 * Clientes OAuth del login con Google nativo.
 *
 * Vacíos por defecto, y eso es lo correcto mientras las apps de iOS y Android
 * no existan en la consola de Firebase: con un client ID vacío el botón nativo
 * no se dibuja (`googleDisponibleEn` en `src/lib/native/google-sign-in.ts`) y
 * `scripts/ios-patch-google.sh` se saltea el parche. El build sale coherente:
 * sin botón y sin esquema de URL, en vez de un botón que no puede funcionar.
 *
 * No son un secreto: un client ID de OAuth es público por diseño —viaja en el
 * Info.plist de cualquier app que lo use— así que pasarlos como variables de
 * build y dejarlos en el bundle es lo normal, no una filtración.
 */
const GOOGLE_IOS_CLIENT_ID = (process.env.MOBILE_GOOGLE_IOS_CLIENT_ID ?? "").trim();
const GOOGLE_WEB_CLIENT_ID = (process.env.MOBILE_GOOGLE_CLIENT_ID ?? "").trim();

/**
 * Se copia por ALLOWLIST, no por denylist.
 *
 * Esto termina adentro de un .ipa que se instala en teléfonos ajenos, así que
 * el default tiene que ser "no se copia". En la raíz del repo viven `.env`,
 * `Dockerfile` y los YAML de Cloud Build; con una denylist, agregar un secreto
 * nuevo a la raíz lo publicaría en silencio. Con allowlist, agregar un
 * directorio de código nuevo rompe el build con un error de módulo no
 * encontrado — que es la falla correcta.
 */
const COPIAR = [
  "src",
  "public",
  "components.json",
  "next-env.d.ts",
  "package.json",
  "postcss.config.mjs",
  "tsconfig.json",
];

/**
 * Entradas de COPIAR que pueden no existir en un checkout limpio porque las
 * genera una herramienta y están en .gitignore. Faltar NO es un error: Next las
 * vuelve a escribir dentro de `.mobile/` al compilar. Todo lo demás sigue
 * siendo obligatorio — un archivo de código que falta tiene que romper el
 * build, no producir un bundle a medias.
 */
const OPCIONALES = new Set(["next-env.d.ts"]);

/**
 * Lo que se poda del árbol copiado, con el motivo por el que no puede viajar.
 * Las rutas son relativas a `.mobile/`.
 */
const PODAR = [
  ["src/app/api", "route handlers dinámicos"],
  ["src/proxy.ts", "Proxy no existe en un export estático"],
  ["src/lib/server-auth.ts", "lee cookies() en el servidor"],
  // Lo importan la home y el detalle de vuelo de la web para elegir el árbol
  // Viajero/Operaciones. Importa server-auth (podado arriba) y `next/headers`,
  // y el typecheck de `next build` lo revisa aunque ninguna página lo
  // alcance: sin esta entrada el bundle fallaba con "Cannot find module
  // '@/lib/server-auth'" desde el PR #55. Las variantes móviles deciden el
  // perfil con `useProfile()`.
  ["src/lib/server-profile.ts", "lee cookies() en el servidor; el bundle usa useProfile()"],
  // Evolución del modelo (admin). Página de servidor en dos sentidos que un
  // export no admite: getServerRole() lee cookies(), y searchParams la vuelve
  // dinámica. Portarla es el patrón vista + wrapper cliente de las demás
  // páginas; mientras tanto el acceso lo esconde REPORTS_ENABLED, así que en
  // el teléfono no hay ningún botón apuntando a una ruta que no existe.
  ["src/app/reports", "getServerRole() lee cookies() y searchParams la hace dinámica"],
];

/**
 * Páginas y componentes que el bundle reemplaza por una variante propia.
 *
 * Todos comparten el mismo motivo: en la web traen sus datos o resuelven el rol
 * en el servidor, y en un export estático eso o no compila o congelaría los
 * datos en la foto del build. Las variantes hacen el mismo trabajo desde el
 * cliente, y reutilizan las vistas puras (`*-view.tsx`) para que lo que se ve
 * en pantalla siga siendo un solo archivo compartido con la web.
 */
const REEMPLAZAR = [
  ["mobile/app-layout.tsx", "src/app/layout.tsx"],
  ["mobile/app-page.tsx", "src/app/page.tsx"],
  ["mobile/admin-layout.tsx", "src/app/admin/layout.tsx"],
  ["mobile/tesis-layout.tsx", "src/app/tesis/layout.tsx"],
  ["mobile/verificacion-page.tsx", "src/app/tesis/verificacion/page.tsx"],
  // Perfil Viajero (PRs #54 a #58). Todas son páginas de servidor en la web;
  // en el export el render corre una sola vez, en build time y sin usuario,
  // así que /mis-vuelos quedaba horneada con el estado de error y las otras
  // con la foto de ese momento. Mismo patrón que las de arriba.
  ["mobile/mis-vuelos-page.tsx", "src/app/mis-vuelos/page.tsx"],
  ["mobile/alertas-page.tsx", "src/app/alertas/page.tsx"],
  ["mobile/anticipacion-page.tsx", "src/app/tesis/anticipacion/page.tsx"],
  ["mobile/components/home-viajero.tsx", "src/components/viajero/home-viajero.tsx"],
  ["mobile/components/metric-cards.tsx", "src/components/metric-cards.tsx"],
  ["mobile/components/model-badge.tsx", "src/components/model-badge.tsx"],
  [
    "mobile/components/operational-impact-cards.tsx",
    "src/components/operational-impact-cards.tsx",
  ],
  ["mobile/components/weather-card.tsx", "src/components/weather-card.tsx"],
];

/**
 * Rutas que en vez de excluirse se mueven a una ruta fija: el id pasa a viajar
 * como query param.
 *
 * `output: 'export'` exige los segmentos dinámicos resueltos en build time vía
 * `generateStaticParams`, y los `fa_flight_id` son datos vivos que no existen
 * cuando compilamos. Quien emite el enlace correcto para cada build es
 * `flightDetailHref()` en `src/lib/routes.ts`.
 */
const MOVER = [["src/app/flights/[id]", "src/app/flights/detail"]];

const log = (msg) => console.log(`[build-mobile] ${msg}`);

function fallar(msg) {
  console.error(`[build-mobile] ERROR: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Árbol limpio
// ---------------------------------------------------------------------------
log(`preparando ${BUILD}`);
rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });

for (const entrada of COPIAR) {
  const origen = join(ROOT, entrada);
  if (!existsSync(origen)) {
    if (OPCIONALES.has(entrada)) {
      log(`omitido (opcional, no existe): ${entrada}`);
      continue;
    }
    fallar(`falta ${entrada} — está en la allowlist pero no existe en el repo`);
  }
  cpSync(origen, join(BUILD, entrada), { recursive: true });
}
log(`copiadas ${COPIAR.length} entradas de la allowlist`);

// ---------------------------------------------------------------------------
// 2. Poda de lo que no puede existir en un export
// ---------------------------------------------------------------------------
for (const [ruta, motivo] of PODAR) {
  const destino = join(BUILD, ruta);
  if (!existsSync(destino)) continue;
  rmSync(destino, { recursive: true, force: true });
  log(`podado ${ruta} — ${motivo}`);
}

// Los tests, estén donde estén. Next los type-checkea como parte del build y
// algunos importan cosas que en .mobile/ no existen o son otras (next.config,
// route handlers podados). Enumerarlos a mano se desactualiza con cada
// directorio __tests__ nuevo; por eso se buscan.
const podarTests = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const ruta = join(dir, e.name);
    if (e.name === "__tests__") {
      rmSync(ruta, { recursive: true, force: true });
      log(`podado ${ruta.slice(BUILD.length + 1)} — tests`);
    } else {
      podarTests(ruta);
    }
  }
};
podarTests(join(BUILD, "src"));

// ---------------------------------------------------------------------------
// 3. Rutas movidas y páginas reemplazadas
// ---------------------------------------------------------------------------
for (const [desde, hasta] of MOVER) {
  const origen = join(BUILD, desde);
  if (!existsSync(origen)) fallar(`no existe la ruta a mover: ${desde}`);
  cpSync(origen, join(BUILD, hasta), { recursive: true });
  rmSync(origen, { recursive: true, force: true });
  log(`movido ${desde} -> ${hasta}`);
}

for (const [desde, hasta] of REEMPLAZAR) {
  const origen = join(ROOT, desde);
  if (!existsSync(origen)) fallar(`falta la variante móvil ${desde}`);
  const destino = join(BUILD, hasta);
  mkdirSync(dirname(destino), { recursive: true });
  cpSync(origen, destino);
}
cpSync(
  join(ROOT, "mobile/flight-detail-page.tsx"),
  join(BUILD, "src/app/flights/detail/page.tsx"),
);
log(`reemplazadas ${REEMPLAZAR.length + 1} páginas/componentes`);

// Ninguna ruta dinámica puede sobrevivir: si queda una, el build falla con un
// error de generateStaticParams que no dice de dónde salió.
const dinamicas = [];
(function buscar(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full = join(dir, e.name);
    if (e.name.includes("[")) dinamicas.push(full.replace(`${BUILD}/`, ""));
    buscar(full);
  }
})(join(BUILD, "src/app"));
if (dinamicas.length > 0) {
  fallar(
    `quedaron rutas con segmento dinámico, que output:'export' no admite sin ` +
      `generateStaticParams:\n  ${dinamicas.join("\n  ")}\n` +
      `Agregalas a MOVER (para que el id viaje como query param) o a PODAR.`,
  );
}

/**
 * Ninguna llamada relativa nueva a un route handler.
 *
 * El WebView corre sobre capacitor://localhost, donde "/api/x" resuelve contra
 * el propio bundle y da 404. Las llamadas legítimas van prefijadas con
 * `appUrl()`, que antepone el origen del deploy.
 *
 * Se comprueba sobre el FUENTE y no sobre el bundle a propósito. En el bundle
 * es indistinguible: `IS_BUNDLED` se importa de otro módulo, el minificador no
 * puede plegar `if (IS_BUNDLED) return nativeLogin(...)`, y las ramas web de
 * `apiLogin`/`apiLogout` sobreviven como literales aunque nunca se ejecuten.
 * Acá, en cambio, hay archivo y línea, y se puede distinguir lo que ya está
 * resuelto de lo que aparezca nuevo.
 */
const FETCH_RELATIVO_PERMITIDO = new Map([
  [
    "src/lib/api.ts",
    "las ramas web de apiLogin/apiLogout, detrás de `if (IS_BUNDLED)`; el " +
      "bundle usa nativeLogin() y clearToken() contra API_ORIGIN",
  ],
]);

const fetchsRelativos = [];
(function buscarFetch(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      buscarFetch(full);
      continue;
    }
    if (!/\.tsx?$/.test(e.name)) continue;
    const rel = full.replace(`${BUILD}/`, "");
    if (FETCH_RELATIVO_PERMITIDO.has(rel)) continue;
    readFileSync(full, "utf8")
      .split("\n")
      .forEach((linea, i) => {
        if (/fetch\(\s*["'`]\/api\//.test(linea)) {
          fetchsRelativos.push(`${rel}:${i + 1}  ${linea.trim()}`);
        }
      });
  }
})(join(BUILD, "src"));

if (fetchsRelativos.length > 0) {
  fallar(
    `hay llamadas a route handlers con ruta relativa, que en el teléfono dan ` +
      `404 contra el propio bundle:\n  ${fetchsRelativos.join("\n  ")}\n` +
      `Prefijalas con appUrl() de src/lib/mobile-env.ts, o sumá el archivo a ` +
      `FETCH_RELATIVO_PERMITIDO explicando por qué es inalcanzable en nativo.`,
  );
}

// ---------------------------------------------------------------------------
// 4. Config, entorno y node_modules
// ---------------------------------------------------------------------------
cpSync(join(ROOT, "next.config.mobile.mjs"), join(BUILD, "next.config.mjs"));

if (STRICT) {
  for (const [nombre, valor] of [
    ["MOBILE_API_ORIGIN", API_ORIGIN],
    ["MOBILE_APP_ORIGIN", APP_ORIGIN],
  ]) {
    if (!/^https:\/\//.test(valor)) {
      fallar(`${nombre} tiene que ser una URL https, y vale "${valor}"`);
    }
  }

  // Los dos client IDs o ninguno. Con uno solo el botón se dibuja —alcanza con
  // que los dos no estén vacíos para eso— y después falla: iOS necesita el
  // propio para identificarse Y el web como `iOSServerClientId`.
  if (Boolean(GOOGLE_IOS_CLIENT_ID) !== Boolean(GOOGLE_WEB_CLIENT_ID)) {
    fallar(
      "MOBILE_GOOGLE_IOS_CLIENT_ID y MOBILE_GOOGLE_CLIENT_ID van juntos: " +
        "con uno solo el botón de Google se dibuja y no puede funcionar. " +
        `iOS="${GOOGLE_IOS_CLIENT_ID}" web="${GOOGLE_WEB_CLIENT_ID}"`,
    );
  }
}

/**
 * Next lee este archivo durante `next build` y reemplaza los
 * `process.env.NEXT_PUBLIC_*` del código por estos valores literales. Es lo que
 * prende las ramas nativas de `src/lib/mobile-env.ts`.
 */
writeFileSync(
  join(BUILD, ".env.production"),
  [
    "# Generado por scripts/build-mobile.mjs -- no editar a mano.",
    "NEXT_PUBLIC_BUNDLED_APP=1",
    "NEXT_PUBLIC_DISABLE_REPORTS=1",
    `NEXT_PUBLIC_API_ORIGIN=${API_ORIGIN}`,
    `NEXT_PUBLIC_APP_ORIGIN=${APP_ORIGIN}`,
    `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID=${GOOGLE_IOS_CLIENT_ID}`,
    `NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_WEB_CLIENT_ID}`,
    "",
  ].join("\n"),
);
log(`API_ORIGIN=${API_ORIGIN}`);
log(`APP_ORIGIN=${APP_ORIGIN}`);

/**
 * `.mobile/` está gitignoreado, y la detección automática de fuentes de
 * Tailwind v4 respeta .gitignore: sin esto genera una hoja de estilos vacía y
 * la app sale sin un solo estilo, sin ningún error que lo avise. El `@source`
 * explícito registra el árbol a mano. La verificación del paso 6 es la red por
 * si esto deja de alcanzar.
 */
const cssPath = join(BUILD, "src/app/globals.css");
const css = readFileSync(cssPath, "utf8");
writeFileSync(
  cssPath,
  css.replace(
    '@import "tailwindcss";',
    '@import "tailwindcss";\n/* Inyectado por scripts/build-mobile.mjs: .mobile/ esta gitignoreado y la\n   deteccion automatica de Tailwind lo saltearia. */\n@source "../../src";',
  ),
);

// Symlink en vez de copia: son cientos de MB y no cambian entre el árbol de la
// web y el móvil.
symlinkSync(join(ROOT, "node_modules"), join(BUILD, "node_modules"), "dir");

if (PREPARE_ONLY) {
  log("--prepare: árbol listo, no se compila");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 5. Build
// ---------------------------------------------------------------------------
log("compilando (next build)...");
const build = spawnSync(join(ROOT, "node_modules/.bin/next"), ["build"], {
  cwd: BUILD,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
if (build.status !== 0) fallar("next build falló");

// ---------------------------------------------------------------------------
// 6. Verificación del bundle
// ---------------------------------------------------------------------------
// Un bundle roto no da error: da una app que arranca en blanco en el teléfono,
// que es donde más caro sale descubrirlo.
const problemas = [];

for (const ruta of [
  "index.html",
  "login/index.html",
  "flights/index.html",
  "flights/detail/index.html",
  "mis-vuelos/index.html",
  "alertas/index.html",
  "tesis/anticipacion/index.html",
]) {
  if (!existsSync(join(OUT, ruta))) problemas.push(`falta ${ruta} en out/`);
}

// Canario de una página de servidor que se coló al export. El render de build
// time corre sin usuario: el fetch falla y el estado de error queda escrito en
// el HTML, para siempre. Pasó con /mis-vuelos en el primer bundle del
// rediseño; la variante cliente de mobile/ prerenderiza un esqueleto.
const misVuelosHtml = join(OUT, "mis-vuelos/index.html");
if (
  existsSync(misVuelosHtml) &&
  /No pudimos traer tus vuelos/.test(readFileSync(misVuelosHtml, "utf8"))
) {
  problemas.push(
    "/mis-vuelos quedó horneada con el estado de error: la página pidió los " +
      "datos en build time. Tiene que entrar en REEMPLAZAR con su variante cliente.",
  );
}

// Y que lo excluido siga excluido.
if (existsSync(join(OUT, "reports"))) {
  problemas.push(
    "/reports quedó en el bundle: está en PODAR porque es una página de servidor. " +
      "Si ahora es compilable, sacalo de PODAR y prendé REPORTS_ENABLED.",
  );
}

function recolectar(dir, ext, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) recolectar(full, ext, acc);
    else if (e.name.endsWith(ext)) acc.push(full);
  }
  return acc;
}

const cssFiles = recolectar(join(OUT, "_next"), ".css");
const cssTotal = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");
if (cssFiles.length === 0) {
  problemas.push("no se emitió ninguna hoja de estilos");
} else if (!/--color-background|\.grid\b|\.text-2xl/.test(cssTotal)) {
  problemas.push(
    "la hoja de estilos no tiene utilidades de Tailwind — la detección de " +
      "fuentes no vio el árbol (revisá el @source que inyecta el paso 4)",
  );
}

const jsFiles = recolectar(join(OUT, "_next"), ".js");
const jsTotal = jsFiles.map((f) => readFileSync(f, "utf8")).join("\n");

/**
 * Que las banderas hayan entrado de verdad.
 *
 * Es LA verificación que importa, porque de estos dos valores depende contra
 * qué habla la app. Si `.env.production` no se hubiera leído, el build saldría
 * igual de verde: `IS_BUNDLED` quedaría en false, `API_ORIGIN` en "" y la app
 * pediría "/flights" contra capacitor://localhost — o sea, 404 en todo, recién
 * visible en el teléfono.
 *
 * Se verifica la presencia de los orígenes como literales: es la huella de que
 * Next reemplazó los `process.env.NEXT_PUBLIC_*` en tiempo de compilación.
 */
for (const [nombre, valor] of [
  ["NEXT_PUBLIC_API_ORIGIN", API_ORIGIN],
  ["NEXT_PUBLIC_APP_ORIGIN", APP_ORIGIN],
]) {
  if (!jsTotal.includes(valor)) {
    problemas.push(
      `${nombre} no quedó inyectado en el bundle (esperaba "${valor}"): sin ` +
        "eso la app no sabe contra qué host hablar y falla recién en el teléfono.",
    );
  }
}

// Los client IDs de Google, solo si se pidieron.
//
// Vacíos no se verifican: ese es el estado normal mientras la consola de
// Firebase no tenga las apps creadas. Pero si alguien los pasó y no quedaron
// inyectados, el síntoma es un botón que no aparece y nadie entiende por qué
// —la app sigue andando con correo y contraseña, así que no hay error que
// mirar—. Es justo el tipo de falla silenciosa que esta sección existe para
// cazar.
for (const [nombre, valor] of [
  ["MOBILE_GOOGLE_IOS_CLIENT_ID", GOOGLE_IOS_CLIENT_ID],
  ["MOBILE_GOOGLE_CLIENT_ID", GOOGLE_WEB_CLIENT_ID],
]) {
  if (valor && !jsTotal.includes(valor)) {
    problemas.push(
      `${nombre} no quedó inyectado en el bundle (esperaba "${valor}"): el ` +
        "botón de Google no se va a dibujar y la app no va a dar ningún error.",
    );
  }
}

// Canario del default de desarrollo de src/lib/api.ts. Si aparece, alguna ruta
// de código server-side se coló al bundle del cliente.
if (/localhost:8000/.test(jsTotal)) {
  problemas.push(
    'quedó "localhost:8000" en el bundle: es el default de desarrollo de ' +
      "src/lib/api.ts y en el teléfono no resuelve.",
  );
}

if (problemas.length > 0) {
  fallar(`el bundle no se sostiene solo:\n  - ${problemas.join("\n  - ")}`);
}

log(`OK — bundle en ${OUT} (${cssFiles.length} css, ${jsFiles.length} js)`);
