#!/usr/bin/env node
/**
 * Genera los gráficos de las fichas de Play y App Store en store/.
 *
 *   TEST_EMAIL=… TEST_PASSWORD=… node scripts/store-assets.mjs [--base http://localhost:3000]
 *
 * Necesita la app corriendo en --base con una cuenta que entre y vea datos
 * (por defecto el dev server local apuntando al backend de producción:
 * `NEXT_PUBLIC_API_URL=https://… pnpm dev`). Usa el Chrome instalado en la
 * Mac vía playwright-core; no baja ningún navegador.
 *
 * Produce:
 *   store/android/icon-512.png            ícono de la ficha (desde assets/icon.png)
 *   store/android/feature-1024x500.png    gráfico destacado
 *   store/android/screenshots/*.png       1170×2340, relación 2:1 (Play acepta hasta 2:1)
 *   store/ios/screenshots/*.png           1320×2868, iPhone 6,9" (obligatorias)
 *
 * Las capturas salen de la web y no del simulador porque Android muestra
 * exactamente esa web, y el bundle de iOS es el mismo Next exportado. Lo que
 * difiere entre plataformas es qué pantallas existen: /live no entra en el
 * bundle de iOS (LIVE_ENABLED), así que no se captura para esa ficha.
 *
 * El overlay de desarrollo de Next (el globo "N issues") se oculta antes de
 * cada captura; en un `next start` de producción no existe.
 */
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";

const { values: args } = parseArgs({
  options: { base: { type: "string", default: "http://localhost:3000" } },
});
const BASE = args.base;
const { TEST_EMAIL: email, TEST_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error("store-assets: faltan TEST_EMAIL y TEST_PASSWORD");
  process.exit(1);
}

const TARGETS = {
  android: { viewport: { width: 390, height: 780 }, scale: 3 },
  ios: { viewport: { width: 440, height: 956 }, scale: 3 },
};

/** Orden de la ficha: primero lo que vende, después lo que explica. */
const SCREENS = [
  { name: "01-live", path: "/live", ios: false, settle: 6000 },
  { name: "02-dashboard", path: "/", settle: 5000 },
  { name: "03-vuelos", path: "/flights", settle: 5000 },
  { name: "04-vuelo", path: "__detalle__", settle: 5000 },
  { name: "05-clima", path: "/weather", settle: 6000 },
  { name: "06-rutas", path: "/routes", settle: 5000 },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function entrar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#username", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /Soy viajero/ }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"), { timeout: 30000 });
  }
}

async function capturar(page, path, file, settle) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(settle);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: file });
}

for (const [target, { viewport, scale }] of Object.entries(TARGETS)) {
  const dir = `store/${target}/screenshots`;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    colorScheme: "dark",
    locale: "es-AR",
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await entrar(page);

  let detalle = null;
  for (const s of SCREENS) {
    if (target === "ios" && s.ios === false) continue;
    let path = s.path;
    if (path === "__detalle__") {
      if (!detalle) {
        await page.goto(`${BASE}/flights`, { waitUntil: "networkidle" });
        await page.waitForTimeout(4000);
        detalle = await page.locator('a[href^="/flights/"]').first().getAttribute("href");
      }
      if (!detalle) {
        console.log(`${target}: no hay vuelos hoy, se saltea el detalle`);
        continue;
      }
      path = detalle;
    }
    await capturar(page, path, `${dir}/${s.name}.png`, s.settle);
    console.log(`${target} ${s.name} ← ${path}`);
  }
  await ctx.close();
}

// Gráfico destacado: la marca sobre el mismo fondo que el splash (#0a0a0a).
{
  mkdirSync("store/android", { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1024, height: 500 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/privacidad`, { waitUntil: "networkidle" });
  await page.setContent(`
    <html><body style="margin:0;width:1024px;height:500px;background:#0a0a0a;
      font-family:Inter,-apple-system,Helvetica,Arial,sans-serif;color:#fafafa;
      display:flex;align-items:center;justify-content:center;gap:56px">
      <img src="${BASE}/icon.png" width="220" height="220" alt="">
      <div>
        <div style="font-size:88px;font-weight:600;letter-spacing:-0.03em;line-height:1">OnTimeAI</div>
        <div style="font-size:30px;color:#a1a1aa;margin-top:18px;line-height:1.3">
          Predicción de retrasos de vuelos<br>en Atlanta, con machine learning
        </div>
      </div>
    </body></html>`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "store/android/feature-1024x500.png" });
  await ctx.close();
  console.log("android feature-1024x500");
}

await browser.close();

// Ícono de la ficha: el mismo de la app, a 512. Sin alpha, como pide Play.
execFileSync("sips", ["-z", "512", "512", "assets/icon.png", "--out", "store/android/icon-512.png"], {
  stdio: "ignore",
});
console.log("android icon-512");
