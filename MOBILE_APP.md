# OnTimeAI — App móvil (Android / iOS)

Para publicar: el procedimiento de iOS está en
[`PUBLICACION-IOS.md`](PUBLICACION-IOS.md) y los metadatos de las dos tiendas en
[`PUBLICACION.md`](PUBLICACION.md). Este archivo es la arquitectura.

Estado al **2026-09-06**. Verificado: el bundle de iOS arranca, muestra el login
y sirve todos sus assets desde el binario, en el simulador de iPhone 17 Pro.

Actualizado el **2026-10-22**: el bundle cubre el perfil Viajero del rediseño
(home, detalle, Mis vuelos, Alertas, Anticipación) y `ci.yml` lo compila en cada
PR. Ver el punto "iOS — perfil Viajero" en §2.

---

## 1. Resumen

**Las dos plataformas no funcionan igual, y la diferencia es deliberada.**

| | Android | iOS |
|---|---|---|
| Assets | Remotos (`server.url` → Cloud Run) | Empaquetados en el `.ipa` |
| Cambio de UI | Deploy normal de la web | Release nativa, u OTA (servidor propio) |
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
- **iOS — perfil Viajero (2026-10-22)**: la web elige la home y el detalle de
  vuelo con `getServerProfile()`, que lee cookies en el servidor; el bundle lo
  elige con `useProfile()` en `mobile/app-page.tsx` y
  `mobile/flight-detail-page.tsx`. `/mis-vuelos`, `/alertas` y
  `/tesis/anticipacion` son páginas de servidor en la web y en el export se
  congelarían en la foto del build (en `/mis-vuelos`, con el estado de error),
  así que tienen variante cliente en `mobile/`. Los enlaces al detalle del
  viajero pasan por `flightDetailHref()`, como los demás. `build-mobile.mjs`
  verifica el HTML generado y `ci.yml` compila el bundle en cada PR: se rompió
  en silencio con el PR #55 y nadie lo vio hasta intentar publicar el OTA
- **iOS — excluido**: `/reports` (Evolución del modelo, solo admin). Es una
  página de servidor por partida doble: `getServerRole()` lee cookies y
  `searchParams` la vuelve dinámica. Su entrada del menú se oculta con
  `REPORTS_ENABLED`. Portarla al bundle es el patrón vista + wrapper cliente
  que usan las demás páginas; está pendiente
- **iOS — auth por Firebase (resuelto el 2026-09-18)**: el login y el alta
  son los mismos que en la web (Firebase se ocupa de las credenciales), con la
  rama del bundle en `api.ts`: `apiLoginFirebase()` / `apiLoginGoogle()` cambian
  el ID token contra `${API_ORIGIN}/auth/firebase|google` directo y guardan el
  JWT en `Preferences` (`nativeExchange`, el mismo patrón que `nativeLogin`);
  `apiMe()` conserva `userType`; `apiSetUserType()` manda `Authorization`;
  `homePathFor()` no manda a un viajero a `/live`, que el bundle no trae; y el
  gate nativo deja ver `/signup` sin sesión, como `proxy.ts`. Verificado con el
  JS del bundle en Chrome (login → onboarding → dashboard → recarga), y por
  `curl` que Firebase y el FastAPI aceptan CORS desde `capacitor://localhost`.
  **Google por plugin nativo**: Google Identity Services no corre en un WebView
  embebido —rechaza el flujo con `disallowed_useragent`, y afecta igual a
  Android, que carga la web remota pero la carga en un WebView—. El camino es
  `@capgo/capacitor-social-login` → ID token de Google →
  `signInWithCredential` del SDK de JS → ID token de Firebase →
  `/auth/firebase`. Ver la sección 9

---

## 3. Archivos

**Compartidos (la web los usa igual)**

| Archivo | Rol |
|---|---|
| `src/lib/mobile-env.ts` | Banderas de build. Sin variables definidas, todo rinde como antes — la web es un no-op verificable |
| `src/lib/routes.ts` | `flightDetailHref()`: emite la forma de enlace que corresponde a cada build |
| `src/lib/native/session.ts` | Token en `@capacitor/preferences` |
| `src/lib/native/google-sign-in.ts` | El plugin de Google y el gate por plataforma |
| `src/lib/auth-google.ts` | Los dos caminos de Google detrás de una sola firma |
| `src/lib/native/app-ready.ts` | Dos señales separadas: confirma el bundle al plugin de OTA apenas React monta; baja el splash recién cuando hay pantalla |
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
| `scripts/ios-patch-google.sh` | Esquema de URL y handler del login con Google. **Código nativo: tampoco** |
| `mobile/*.tsx`, `mobile/components/*.tsx` | Las páginas/componentes que el bundle reemplaza (la lista es `REEMPLAZAR` en `build-mobile.mjs`) |
| `ios/` | **No versionado**: se regenera con `npx cap add ios` |

---

## 4. Cómo se compila

### Android

```bash
pnpm cap:android            # sync + abrir Android Studio
```

En la nube: *Actions* → **Android Build** → *Run workflow* → `debug` o `release`.

- `debug` → APK instalable por sideload.
- `release` → AAB firmado para Play Console. Necesita los secrets del keystore
  y el input `version` (semver); el `versionCode` es el número del run.
- `release` + `subir` → además lo deja en la pista de Play elegida (`internal`,
  `alpha` o `production`) con `scripts/play-upload.mjs`. La identidad es el
  service account `play-publisher` por Workload Identity: no hay clave JSON.
  Sus permisos se dan en Play Console (*Usuarios y permisos*), no en GCP.

### iOS

```bash
pnpm cap:ios                # bundle + config + sync + parche + abrir Xcode

# Con OTA activo (lo que compila CI para TestFlight): la versión es obligatoria
MOBILE_OTA=1 MOBILE_APP_VERSION=1.0.0 bash scripts/ios-prepare.sh
```

En la nube: *Actions* → **iOS Release (TestFlight)**. El input `version` fija
`MARKETING_VERSION` en xcodebuild y `plugins.CapacitorUpdater.version` en el
config — una sola fuente para App Store y para el OTA. El número de build es el
del run de Actions, así nunca se repite.

Con **Xcode 27** en local, `xcodebuild` rechaza el target iOS 14.0 que genera
Capacitor 7 en los Pods. Se pasa `IPHONEOS_DEPLOYMENT_TARGET=15.0` en la línea
de comandos (o se sube el target en Xcode); CI no lo necesita porque `macos-15`
trae Xcode 16.

CI compila este mismo bundle en cada PR (`ci.yml`, paso *Bundle móvil*), con
`--strict` y las variables `MOBILE_*` del repo. Un PR que rompe el export no
llega a main.

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
| `ANDROID_KEYSTORE_BASE64` + `_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Firmar el AAB de release | Keystore en `~/.ontimeai/`; los carga `configurar-android.sh` |
| `IOS_CERTIFICATE_P12_BASE64` + `_PASSWORD` | Firmar el `.ipa` | Falta exportarlo de la cuenta Apple |
| `IOS_PROVISIONING_PROFILE_BASE64`, `IOS_TEAM_ID` | Perfil y equipo | Falta |
| `APPSTORE_API_KEY_ID`, `_ISSUER_ID`, `_PRIVATE_KEY` | Subir a TestFlight | Falta |

Variables (no secretas): `MOBILE_API_ORIGIN`, `MOBILE_APP_ORIGIN`.

Sin ninguno de estos, `android-build.yml` igual produce un APK debug y
`ios-release.yml` igual verifica que todo compile (build sin firmar).

### Keystore de Android

Generado el 2026-09-18 con OpenSSL (no hay JDK en la Mac): PKCS12, RSA 4096,
alias `upload`, válido hasta 2056, en `~/.ontimeai/android-upload.p12` con la
contraseña al lado. `build.gradle` lo abre con `storeType "PKCS12"`, que en
Java también lee un JKS por si se regenera con `keytool`.

**Hacele backup fuera de la Mac.** Como la app usa Play App Signing, esta es
la clave de *subida*: perderla se arregla pidiendo un reset a Google, pero es
un trámite de días.

---

## 7. OTA de iOS — servidor propio

El plugin es `@capgo/capacitor-updater` (MPL-2.0), pero el cloud de Capgo no
interviene: la cuenta que se creó el 2026-09-16 se probó, funcionó, y se
descartó porque no es gratis (trial de 15 días, después ~USD 12–15/mes). Lo que
el plugin necesita es solo un endpoint, y ese endpoint es nuestro.

| Pieza | Dónde | Qué hace |
|---|---|---|
| `src/app/api/ota/updates/route.ts` | Next en Cloud Run | Recibe el `POST` del plugin, lee el manifest y contesta `{version, url, checksum}` o `{kind: "up_to_date"}` |
| `gs://ontimeai-ota/ios/` | GCS, proyecto `ontimeai-prod`, lectura pública | `manifest.json` + un `<version>.zip` por bundle |
| `scripts/ota-publish.mjs` | local o CI | `upload`, `set` (apuntar un canal), `retire`, `status`. Toda la "base de datos" es el manifest |
| `ios-ota.yml` | GitHub Actions | El script con la identidad de `deploy.yml` (`github-deployer`, `objectAdmin` sobre el bucket) |

El contrato está leído del Swift del plugin y documentado en el route handler:
`kind` solo puede ser `up_to_date`, `blocked` o `failed`; el checksum es el
SHA-256 del zip; `index.html` va en la raíz del zip. El manifest se sube con
`Cache-Control: no-cache` para que un rollback rija de inmediato, y la URL va
hardcodeada en el código con override por env porque `deploy.yml` borra las
variables de Cloud Run que no pasa.

Canales, sin registro de dispositivos: el binario decide.

| Canal | Quién lo mira |
|---|---|
| `production` | todo binario compilado con `ota: true` que no fije canal |
| `staging` | un build compilado con `MOBILE_OTA_CHANNEL=staging` (lo manda como `defaultChannel`) |

Reglas del servidor: no ofrece un bundle igual al que corre, ni uno anterior a
la versión nativa instalada, ni uno cuyo `min_native` supere esa versión (es el
reemplazo manual de `--fail-on-incompatible`). Cada consulta deja una línea
JSON en el log de Cloud Run con dispositivo, canal, versión y decisión: eso son
las "estadísticas".

**Verificado en el simulador el 2026-09-16, de punta a punta**, con el route
handler corriendo en `next dev` y `MOBILE_OTA_URL` apuntando a él: binario 1.0.0
→ 1.0.1 detectado, descargado con checksum igual al del manifest, aplicado,
`notifyAppReady` a tiempo; un bundle con cambio visible llegó sin reinstalar ni
`cap sync`; `set --channel production --version 1.0.1` hizo volver al
dispositivo. `production` quedó en **1.0.1**, idéntico al build nativo. Lo que
no probé: el mismo handler en Cloud Run, que existe recién a partir del deploy
que incluya este código — un `curl -X POST .../api/ota/updates` con el JSON del
test lo confirma en segundos.

Sigue siendo opt-in por build: `autoUpdate` es `MOBILE_OTA=1`, que
`ios-release.yml` setea con `ota: true`. Un build de desarrollo no lo prende
porque el plugin bloquea el arranque contra un semáforo hasta `appReadyTimeout`
si no puede hablar con el servidor. Un binario con `ota: false` **no recibe
OTAs**: publicar un bundle no le llega.

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

## 9. Login con Google nativo

Google Identity Services —el botón de la web— se niega a correr dentro de un
WebView embebido: rechaza el flujo con `disallowed_useragent`. Es una política
de Google para que una app no pueda mostrar una pantalla de login de Google
falsa, así que no hay forma de sortearla desde JS. Afecta a **las dos**
plataformas: Android carga la web remota de Cloud Run, pero la carga en un
WebView.

### El camino

```
plugin nativo  →  ID token de Google  →  signInWithCredential  →  ID token de
                                          (SDK de JS)              Firebase
                                                                      ↓
                                                             /auth/firebase
```

Google entra por Firebase y no por `/auth/google`, que es la decisión del issue
#46: un solo sistema de credenciales en vez de dos. La web sigue por
`/auth/google` mientras el proveedor de Google no esté habilitado en Firebase
Authentication; migrarla antes la rompería.

`signInWithCredential` **sí** se puede usar en el bundle, a diferencia de
`signInWithPopup`: es una llamada HTTP y no necesita el popup/redirect
resolver, que es justo el que `firebase.ts` omite a propósito porque desde
`capacitor://localhost` su iframe nunca contesta y deja toda operación de Auth
encolada para siempre, sin error ni timeout.

### Las piezas

| Archivo | Rol |
|---|---|
| `src/lib/native/google-sign-in.ts` | El plugin: `initialize` una vez, `login`, y el gate por plataforma |
| `src/lib/auth-google.ts` | Los dos caminos (web y teléfono) detrás de una sola firma |
| `src/components/google-sign-in-button.tsx` | Elige la variante y devuelve una sesión, no un token |
| `scripts/ios-patch-google.sh` | Esquema de URL en `Info.plist` + handler en `AppDelegate`. **Código nativo: no se arregla por OTA** |

### Esto NO llega por OTA

El OTA entrega un zip del bundle web. El login con Google necesita un pod, un
esquema de URL en `Info.plist` y un handler en `AppDelegate.swift`: nada de eso
viaja en ese zip. **Cambiar algo de esta sección exige recompilar y subir un
build nuevo a TestFlight.**

### Los client IDs son dos y no se intercambian

| | iOS | Android |
|---|---|---|
| client ID propio | sí, y su versión invertida es el esquema de URL | **no existe** |
| client ID web | sí, como `iOSServerClientId` | sí, es el único que necesita |
| cómo se identifica | por el client ID de iOS | por package name + huella SHA-1 |

Pedirle a Android el client ID de iOS deja el botón escondido para siempre, y
es una falla silenciosa: la app sigue andando con correo y contraseña, así que
no hay error que mirar. Lo fija `google-nativo.test.ts`.

Las variables de build son `MOBILE_GOOGLE_IOS_CLIENT_ID` y
`MOBILE_GOOGLE_CLIENT_ID`, y van como `vars` de GitHub y no como `secrets`: un
client ID de OAuth es público por diseño —viaja en el `Info.plist` de
cualquier app que lo use— y como secret quedaría enmascarado en los logs sin
ningún beneficio. `build-mobile.mjs --strict` exige los dos o ninguno: con uno
solo el botón se dibuja y no puede funcionar.

### Configuración pendiente (consola de Firebase, `ontimeai-prod`)

Sin esto el código compila, el botón no se dibuja y el parche nativo se saltea
—el build sale coherente, nada promete lo que no puede cumplir—, pero el login
con Google en el teléfono no existe:

1. **Authentication → Sign-in method → Google**: habilitar.
2. **Agregar app iOS** con bundle ID `com.ontimeai.app`. De ahí sale el client
   ID de iOS → `MOBILE_GOOGLE_IOS_CLIENT_ID`.
3. **Agregar app Android** con package `com.ontimeai.app` y **dos** huellas
   SHA-1:
   - la de la clave de subida (`ONTIMEAI_KEYSTORE_FILE` en los secrets;
     `keytool -list -v`)
   - la de **Play App Signing** (Play Console → Configuración → Firma de la
     aplicación)

   La segunda es la que se olvida. La app usa Play App Signing, así que
   registrando solo la de subida el login funciona en un APK compilado a mano
   y **falla para cualquiera que instale desde Play**.

---

## 10. Gotchas verificados

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

7. **`notifyAppReady()` no puede esperar a la sesión.** El plugin revierte el
   bundle si no llega en 10 s, y `/auth/me` contra un Cloud Run frío puede tardar más:
   un backend lento se leería como un bundle roto y desharía un OTA sano en
   cada arranque en frío. Por eso se llama apenas React monta —eso ya prueba
   que el bundle carga— y el splash se baja aparte, cuando hay pantalla.

8. **El puente de Capacitor imprime los valores de `Preferences` en la consola.**
   En un build Debug cada `Preferences get` sale con su `value` — o sea, el
   token de sesión en texto plano. Un log del simulador es un secreto: no
   pegarlo en issues ni en documentación sin filtrar esas líneas.

9. **Una versión de bundle es inmutable.** El plugin identifica el bundle por
   su versión: si ya bajó 1.0.2, no vuelve a bajar otro 1.0.2 con contenido
   distinto. `ota-publish.mjs upload` se niega a pisar una versión, y `retire`
   avisa que no se reutilice el número. Cada publicación es la siguiente.

10. **Para probar el OTA contra un servidor local hay que abrirle ATS.** El
   plugin descarga con URLSession, y iOS bloquea `http://` por defecto. Con
   `MOBILE_OTA_URL=http://localhost:3000/api/ota/updates` y
   `NSAllowsLocalNetworking = true` en el `Info.plist` generado (`ios/` no está
   versionado) el simulador llega al `next dev` del Mac. Nada de eso va al repo.
