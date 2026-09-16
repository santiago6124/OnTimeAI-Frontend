# OnTimeAI — App móvil (Android / iOS)

Para publicar: el procedimiento de iOS está en
[`PUBLICACION-IOS.md`](PUBLICACION-IOS.md) y los metadatos de las dos tiendas en
[`PUBLICACION.md`](PUBLICACION.md). Este archivo es la arquitectura.

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
- **iOS — excluido**: `/reports` (Evolución del modelo, solo admin). Es una
  página de servidor por partida doble: `getServerRole()` lee cookies y
  `searchParams` la vuelve dinámica. Su entrada del menú se oculta con
  `REPORTS_ENABLED`. Portarla al bundle es el patrón vista + wrapper cliente
  que usan las demás páginas; está pendiente
- **iOS — pendiente (2026-09-16)**: el flujo de auth nuevo (Firebase, Google,
  onboarding, PRs #25–#29) no tiene rama para el bundle. `apiLoginFirebase()`
  y `apiLoginGoogle()` llaman a `/api/auth/*` relativo, que en el teléfono no
  existe; `apiSetUserType()` no manda `Authorization`; `apiMe()` no trae
  `userType`; y el botón de Google necesita `NEXT_PUBLIC_GOOGLE_CLIENT_ID` y un
  origen `https`, que `capacitor://localhost` no es (hace falta un plugin nativo
  de Google Sign-In). **El login del bundle compilado desde `main` no funciona
  hasta resolver esto** — no publicar un OTA ni una release desde `main` antes.
  `production` en Capgo sigue en 1.0.1, anterior a esos cambios, y su login anda

---

## 3. Archivos

**Compartidos (la web los usa igual)**

| Archivo | Rol |
|---|---|
| `src/lib/mobile-env.ts` | Banderas de build. Sin variables definidas, todo rinde como antes — la web es un no-op verificable |
| `src/lib/routes.ts` | `flightDetailHref()`: emite la forma de enlace que corresponde a cada build |
| `src/lib/native/session.ts` | Token en `@capacitor/preferences` |
| `src/lib/native/app-ready.ts` | Dos señales separadas: confirma el bundle a Capgo apenas React monta; baja el splash recién cuando hay pantalla |
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

# Con OTA activo (lo que compila CI para TestFlight): la versión es obligatoria
MOBILE_CAPGO=1 MOBILE_APP_VERSION=1.0.0 bash scripts/ios-prepare.sh
```

En la nube: *Actions* → **iOS Release (TestFlight)**. El input `version` fija
`MARKETING_VERSION` en xcodebuild y `plugins.CapacitorUpdater.version` en el
config — una sola fuente para App Store y para Capgo. El número de build es el
del run de Actions, así nunca se repite.

Con **Xcode 27** en local, `xcodebuild` rechaza el target iOS 14.0 que genera
Capacitor 7 en los Pods. Se pasa `IPHONEOS_DEPLOYMENT_TARGET=15.0` en la línea
de comandos (o se sube el target en Xcode); CI no lo necesita porque `macos-15`
trae Xcode 16.

Para probar el bundle sin Xcode, en un navegador de escritorio:

```bash
pnpm build:mobile
cd .mobile/out && python3 -m http.server 8899
```

Es el ciclo de depuración rápido: el mismo JS que corre en el teléfono, con la
consola del navegador disponible. Así se encontró el bug de `Preferences.then()`.

---

## 5. CORS del backend — resuelto

El bundle de iOS le habla al FastAPI desde `capacitor://localhost`. Ese origen
tiene que estar en la allowlist de CORS del backend o el login falla, aunque las
credenciales sean correctas.

Está puesto en dos lugares, a propósito:

| Dónde | Qué cubre |
|---|---|
| `ALLOWED_ORIGINS` en el service `ontimeai-backend` de Cloud Run | producción, vivo desde la revisión `00007-r8n` |
| La lista por defecto de `api.py` | desarrollo local y cualquier deploy futuro sin esa variable |

**La variable de entorno tapa el default del código.** Si sumás un origen en
`api.py`, hay que actualizar también la variable en Cloud Run:

```bash
gcloud run services update ontimeai-backend \
  --region us-central1 --project ontimeai-prod \
  --update-env-vars "^|^ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://ontimeai-frontend-871707213932.us-central1.run.app,capacitor://localhost"
```

El `^|^` no es decorativo: le dice a gcloud que separe los pares por `|` en vez
de por coma, que es lo que necesita un valor que lleva comas adentro.

> La web no depende de este CORS: el navegador nunca habla con el FastAPI
> directo, pega contra el BFF `/api/backend/*`, que hace la llamada servidor a
> servidor. Por eso la lista estuvo desactualizada mucho tiempo sin que nada
> fallara — el bundle nativo es el primer cliente que la necesita de verdad.

Si algún día Android pasa a servir sus assets desde el binario, su origen es
`https://localhost` y hay que sumarlo.

## 6. Secrets de CI

| Secret | Para qué | Estado |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` + `_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Firmar el AAB de release | Falta crear el keystore |
| `IOS_CERTIFICATE_P12_BASE64` + `_PASSWORD` | Firmar el `.ipa` | Falta exportarlo de la cuenta Apple |
| `IOS_PROVISIONING_PROFILE_BASE64`, `IOS_TEAM_ID` | Perfil y equipo | Falta |
| `APPSTORE_API_KEY_ID`, `_ISSUER_ID`, `_PRIVATE_KEY` | Subir a TestFlight | Falta |
| `CAPGO_TOKEN` | OTA de iOS | Cuenta creada el 2026-09-16. **Falta cargar el secret**: generá una key con permiso `upload` solamente (Capgo → Settings → API keys), no la de onboarding |

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

## 7. Capgo (OTA de iOS) — configurado, se prende por build

Cuenta creada el 2026-09-16: organización **OntimeAI**, app `com.ontimeai.app`
(mismo id que el bundle, pero Capgo lo lee de `plugins.CapacitorUpdater.appId`,
no del `appId` de Capacitor). Canales:

| Canal | Rol | Quién lo mira |
|---|---|---|
| `production` | default de la nube | todo binario compilado con `capgo: true` que no diga otra cosa |
| `staging` | privado, con auto-asignación | un build compilado con `MOBILE_CAPGO_CHANNEL=staging`, o un dispositivo forzado desde la consola |

El config **no** fija `defaultChannel`: lo decide la nube, y así un dispositivo
se puede mover de canal desde la consola sin recompilar.

**Verificado en el simulador el 2026-09-16, de punta a punta**: binario 1.0.0 →
bundle 1.0.1 detectado, descargado (checksum igual al del upload), aplicado al
pasar a segundo plano, `notifyAppReady` a tiempo, sin rollback. Después un
bundle con un cambio visible en el login llegó a la misma app sin reinstalar ni
`cap sync`, y al devolver el canal a 1.0.1 desde la CLI el dispositivo volvió.
`production` quedó en **1.0.1**, idéntico al build nativo.

Sigue siendo opt-in por build: `autoUpdate` es `MOBILE_CAPGO=1`, que
`ios-release.yml` setea con `capgo: true`. La razón de que no esté prendido de
fábrica sigue vigente para cualquier build sin cuenta: el plugin bloquea el
arranque contra un semáforo hasta `appReadyTimeout` si el cloud le contesta 429.
Un binario compilado con `capgo: false` **no recibe OTAs**, publicar un bundle
no le llega.

La cuenta está en período de prueba (vence ~2026-10-01): hay que elegir un plan
antes, o los dispositivos dejan de recibir bundles.

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

6. **`viewport-fit: cover` sin CSS de safe-area deja el header bajo el reloj.**
   Los dos lados van juntos: el config pide `contentInset: 'never'` para que iOS
   no padee por su cuenta, y entonces separar el contenido del notch y de la
   barra de gestos es responsabilidad del CSS (`.safe-top` / `.safe-bottom` en
   globals.css). En un navegador de escritorio esos `env()` valen 0, así que el
   agregado es un no-op exacto para la web.

7. **`notifyAppReady()` no puede esperar a la sesión.** Capgo revierte el bundle
   si no llega en 10 s, y `/auth/me` contra un Cloud Run frío puede tardar más:
   un backend lento se leería como un bundle roto y desharía un OTA sano en
   cada arranque en frío. Por eso se llama apenas React monta —eso ya prueba
   que el bundle carga— y el splash se baja aparte, cuando hay pantalla.

8. **El puente de Capacitor imprime los valores de `Preferences` en la consola.**
   En un build Debug cada `Preferences get` sale con su `value` — o sea, el
   token de sesión en texto plano. Un log del simulador es un secreto: no
   pegarlo en issues ni en documentación sin filtrar esas líneas.

9. **La CLI de Capgo lee siempre `capacitor.config.ts`.** Igual que la de
   Capacitor, no acepta `--config`. Para subir un bundle a mano hay que copiar
   `capacitor.config.ios.ts` encima y restaurar después; si no, toma el config
   de Android (`webDir` distinto, `autoUpdate: false`). `ios-ota.yml` ya lo
   hace en el checkout efímero.
