# OnTimeAI — App móvil (Android / iOS)

Estado al **2026-09-06**. Verificado: el bundle de iOS arranca, muestra el login
y sirve todos sus assets desde el binario, en el simulador de iPhone 17 Pro.

---

## 1. Resumen

**Las dos plataformas no funcionan igual, y la diferencia es deliberada.**

| | Android | iOS |
|---|---|---|
| Assets | Remotos (`server.url` → Cloud Run) | Empaquetados en el `.ipa` |
| Cambio de UI | Deploy normal de la web | Release nativa, u OTA con Capgo |
| Sin conexión | No bootea | Bootea con el bundle instalado |
| Auth | Cookie `HttpOnly` + BFF, igual que la web | Token en almacenamiento nativo + `Bearer` |
| Código propio | **Ninguno** | El árbol paralelo de `mobile/` |

Android es un WebView contra el sitio desplegado: la variante más simple que
existe y la que pediste. No requiere una sola línea de código en la app, porque
adentro del WebView el origen es el mismo sitio de siempre — la cookie viaja, el
BFF `/api/backend/*` funciona y `proxy.ts` sigue guardando las rutas.

iOS **no puede** hacer eso. App Review rechaza bajo **Guideline 5.6** las apps
que son un shell apuntando a una URL; la app de Lia fue suspendida exactamente
así el 2026-07-30. Por eso su bundle viaja adentro del binario, y por eso todo el
trabajo de esta migración está del lado de iOS.

---

## 2. Arquitectura

**Android — modo remoto**

```
┌──────────────────────────┐      carga (server.url)     ┌──────────────────────────┐
│  App nativa (Capacitor)  │ ─────────────────────────▶  │  Next.js en Cloud Run    │
│  WebView + plugins       │                             │  SSR, route handlers,    │
│                          │ ◀─────────────────────────  │  proxy.ts, BFF           │
└──────────────────────────┘     HTML/JS/CSS + datos     └──────────────────────────┘
```

**iOS — assets empaquetados**

```
┌────────────────────────────────┐                      ┌──────────────────────────┐
│  App nativa (Capacitor)        │   solo datos:        │  FastAPI en Cloud Run    │
│  ┌──────────────────────────┐  │  ──────────────▶     │  (NO se empaqueta)       │
│  │ .mobile/out (17 páginas) │  │   Bearer token       └──────────────────────────┘
│  │ HTML/JS/CSS/fuentes      │  │
│  └──────────────────────────┘  │   /api/weather       ┌──────────────────────────┐
│  StaticExportRouter (Swift)    │  ──────────────▶     │  Next.js en Cloud Run    │
└────────────────────────────────┘                      └──────────────────────────┘
```

Lo que viaja en el `.ipa` es **únicamente la UI**. Los datos siguen saliendo de
Cloud Run.

### Datos técnicos

- **appId**: `com.ontimeai.app` · **appName**: OnTimeAI
- **Capacitor 7** (no 8: la 8 exige Node ≥22 y el repo está en Node 20)
- **Android**: URL que abre la app → `CAP_SERVER_URL`, default el Cloud Run del frontend
- **iOS**: 17 páginas estáticas, ~8.3 MB de bundle / ~28 MB de `.app`
- **iOS — rutas**: `/flights/[id]` viaja como `/flights/detail/?id=…`, porque
  `output: 'export'` no admite segmentos dinámicos sin `generateStaticParams` y
  los `fa_flight_id` son datos vivos
- **iOS — excluido**: `/live` (la vista Lite). Su layout llama a
  `getVerifiedSession()`, que lee la cookie con `next/headers`, y `cookies()` no
  existe en un export. Es además una superficie pública para compartir por web;
  la app ya trae el dashboard completo. El toggle Lite/Pro del header se oculta
  con `LIVE_ENABLED`, así que no queda ningún botón apuntando a una ruta
  inexistente — que es motivo de rechazo en App Review

---

## 3. Archivos

**Compartidos (la web los usa igual)**

| Archivo | Rol |
|---|---|
| `src/lib/mobile-env.ts` | Banderas de build. Sin variables definidas, todo rinde como antes — la web es un no-op verificable |
| `src/lib/routes.ts` | `flightDetailHref()`: emite la forma de enlace que corresponde a cada build |
| `src/lib/native/session.ts` | Token en `@capacitor/preferences` |
| `src/lib/native/app-ready.ts` | Baja el splash y confirma el bundle a Capgo |
| `src/components/providers/native-session-provider.tsx` | El gate de sesión: reemplazo de `proxy.ts` en el bundle |
| `src/components/*-view.tsx` | Vistas puras. Web y móvil traen los datos distinto pero dibujan lo mismo |

**Android**

| Archivo | Rol |
|---|---|
| `capacitor.config.ts` | `server.url`, splash, status bar. `CapacitorUpdater.autoUpdate: false` |
| `android/` | Proyecto nativo, versionado |
| `mobile/shell/index.html` | Stub que exige la CLI para `webDir`. Nunca se renderiza |

**iOS**

| Archivo | Rol |
|---|---|
| `capacitor.config.ios.ts` | Sin `server.url`. El CI lo copia sobre `capacitor.config.ts` |
| `next.config.mobile.mjs` | `output: 'export'`, `trailingSlash`, sin headers |
| `scripts/build-mobile.mjs` | Arma `.mobile/out`: copia por allowlist, poda, verifica |
| `scripts/ios-prepare.sh` | Todo lo anterior + sync + parche, sin dejar el repo pisado |
| `scripts/ios-patch-router.sh` | El router de assets. **Código nativo: no se arregla por OTA** |
| `mobile/*.tsx` | Las 9 páginas/componentes que el bundle reemplaza |
| `ios/` | **No versionado**: se regenera con `npx cap add ios` |

---

## 4. Cómo se compila

### Android

```bash
pnpm cap:android            # sync + abrir Android Studio
```

En la nube: *Actions* → **Android Build** → *Run workflow* → `debug` o `release`.

- `debug` → APK instalable por sideload.
- `release` → AAB firmado para Play Console. Necesita los secrets del keystore.

### iOS

```bash
pnpm cap:ios                # bundle + config + sync + parche + abrir Xcode
```

En la nube: *Actions* → **iOS Release (TestFlight)**.

Para probar el bundle sin Xcode, en un navegador de escritorio:

```bash
pnpm build:mobile
cd .mobile/out && python3 -m http.server 8899
```

Es el ciclo de depuración rápido: el mismo JS que corre en el teléfono, con la
consola del navegador disponible. Así se encontró el bug de `Preferences.then()`.

---

## 5. ⚠️ Lo único que falta y no está en este repo

**El backend tiene que permitir el origen del WebView.**

El bundle de iOS le habla al FastAPI desde `capacitor://localhost`, y hoy el
backend no lo tiene en su allowlist de CORS. Sin esto la app abre y muestra el
login, pero **el login falla**.

Comprobado el 2026-09-06 contra el backend desplegado:

```
http://localhost:3000                                → permitido
https://ontimeai-frontend-hq7henvhjq-uc.a.run.app    → permitido
capacitor://localhost                                → SIN Access-Control-Allow-Origin
```

Es un cambio de variable de entorno, sin tocar código:

```bash
gcloud run services update ontimeai-backend \
  --region us-central1 --project ontimeai-prod \
  --update-env-vars 'ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://ontimeai-frontend-871707213932.us-central1.run.app,capacitor://localhost'
```

> Nota: hoy la web no depende de ese CORS. El navegador nunca habla con el
> FastAPI directo — pega contra el BFF `/api/backend/*`, que hace la llamada
> servidor a servidor. Por eso la lista está desactualizada sin que nada falle.
> El bundle nativo es el primer cliente que sí la necesita.

La alternativa, si no se puede tocar el backend, es activar `CapacitorHttp`, que
saca las llamadas del WebView y las hace nativas, salteando CORS. No se eligió
porque parchea `fetch` globalmente y las navegaciones de Next también lo usan.

---

## 6. Secrets de CI

| Secret | Para qué | Estado |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` + `_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Firmar el AAB de release | Falta crear el keystore |
| `IOS_CERTIFICATE_P12_BASE64` + `_PASSWORD` | Firmar el `.ipa` | Falta exportarlo de la cuenta Apple |
| `IOS_PROVISIONING_PROFILE_BASE64`, `IOS_TEAM_ID` | Perfil y equipo | Falta |
| `APPSTORE_API_KEY_ID`, `_ISSUER_ID`, `_PRIVATE_KEY` | Subir a TestFlight | Falta |
| `CAPGO_TOKEN` | OTA de iOS | **No hay cuenta de Capgo todavía** |

Variables (no secretas): `MOBILE_API_ORIGIN`, `MOBILE_APP_ORIGIN`.

Sin ninguno de estos, `android-build.yml` igual produce un APK debug y
`ios-release.yml` igual verifica que todo compile (build sin firmar).

### Keystore de Android

```bash
keytool -genkey -v -keystore ontimeai.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias ontimeai
base64 -i ontimeai.jks | pbcopy     # → ANDROID_KEYSTORE_BASE64
```

**Guardalo fuera del repo y con backup.** Perderlo significa no poder volver a
actualizar la app publicada en Play.

---

## 7. Capgo (OTA de iOS) — apagado por ahora

El plugin viaja en el binario y `notifyAppReady()` ya está cableado, pero
`autoUpdate` arranca **apagado**.

No es una omisión: con `autoUpdate: true` y sin cuenta configurada, el plugin
consulta el cloud de Capgo en cada arranque, cobra un `429 (on_premise_app)` y
bloquea el inicio contra un semáforo hasta que vence `appReadyTimeout`. Son diez
segundos de pantalla muerta a cambio de nada, porque no hay ningún bundle que
bajar. Está medido en los logs del simulador.

Cuando exista la cuenta, prenderlo es una sola cosa: correr `ios-release.yml`
con `capgo: true` (que setea `MOBILE_CAPGO=1`). No hay código que tocar.

---

## 8. Si Play Store objeta el shell remoto

Google es más permisivo que Apple, pero su política de "webview-only apps"
existe. Si alguna vez rechaza el APK, **el bundle empaquetado ya está hecho**:
apuntar Android al mismo `.mobile/out` es cambiar `webDir` y sacar `server` de
`capacitor.config.ts`.

Lo que hay que revisar en ese caso, porque Android no lo tiene resuelto hoy:

1. El equivalente del `StaticExportRouter` (Android usa otro resolvedor de assets).
2. La auth pasa de cookie a token nativo, igual que iOS — el código ya existe y
   se activa con `NEXT_PUBLIC_BUNDLED_APP=1`.
3. `https://localhost` tiene que entrar en el CORS del backend (ya está en la
   allowlist de `/api/weather`).

---

## 9. Gotchas verificados

1. **Nunca devuelvas un plugin de Capacitor desde una función `async`.** El
   proxy convierte el acceso a cualquier propiedad en una llamada nativa; la
   maquinaria de promesas le lee `.then`, y la llamada viaja al puente como un
   método que no existe. El síntoma es peor que un error: la promesa **nunca se
   resuelve** y la app se queda en la pantalla de carga para siempre. Pasó acá y
   está documentado en `src/lib/native/session.ts`.

2. **Tailwind v4 respeta `.gitignore`.** `.mobile/` está ignorado, así que la
   detección automática de fuentes lo saltea y genera una hoja vacía — una app
   sin un solo estilo, sin ningún error. `build-mobile.mjs` inyecta un `@source`
   explícito y **verifica** que la hoja emitida tenga utilidades de verdad.

3. **`turbopack.root` tiene que ser el repo, no `.mobile/`.** `node_modules` es
   un symlink hacia arriba, y Turbopack rechaza los symlinks que salen de su
   raíz con un `points out of the filesystem root`.

4. **Buscar strings en el bundle minificado no sirve para detectar código
   muerto.** `IS_BUNDLED` se importa de otro módulo, el minificador no puede
   plegar los ternarios, y las ramas web sobreviven como literales aunque nunca
   se ejecuten. Por eso la comprobación de rutas relativas se hace sobre el
   fuente, donde hay archivo y línea.

5. **El router de iOS es código nativo.** Si se rompe, un OTA no lo arregla:
   hay que pasar por App Review.
