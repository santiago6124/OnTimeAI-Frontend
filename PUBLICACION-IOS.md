# Publicación en iOS — procedimiento

Los pasos para llevar OnTimeAI de este repo a la App Store, en orden, con lo que
hay que crear en cada consola y por qué.

Esto es el **procedimiento**. Los textos y metadatos que piden los formularios
están en [`PUBLICACION.md`](PUBLICACION.md), y la arquitectura de la app móvil en
[`MOBILE_APP.md`](MOBILE_APP.md).

---

## Lo que hace a iOS distinto de Android

Android es un WebView que abre el sitio desplegado. iOS **no puede serlo**: App
Review rechaza bajo **Guideline 5.6 (Developer Code of Conduct)** y **4.2
(Minimum Functionality)** las apps que son un contenedor apuntando a una URL. La
app de Lia fue suspendida exactamente así el 2026-07-30.

Por eso el `.ipa` de OnTimeAI lleva la interfaz adentro del binario y solo
consulta datos por HTTPS. Todo el procedimiento de abajo existe para sostener esa
diferencia — y el paso 7 es el que hay que saber defender si te preguntan.

---

## 0 · Bloqueadores conocidos

### ✅ Ícono — resuelto el 2026-09-16

Las dos plataformas usaban el placeholder de Capacitor. Ahora los íconos y el
splash se generan desde `assets/icon.png` y `assets/splash*.png` (versionados,
derivados de `public/logo.png`: a sangre, 1024×1024, sin alpha) con
`@capacitor/assets`, tanto en `scripts/ios-prepare.sh` como en `ios-release.yml`.
El workflow además verifica el PNG (1024×1024 y sin canal alpha) antes de firmar.
Está confirmado dentro del `.app` de iOS y del APK. No hay que hacer nada a
mano; si cambia el arte, se reemplaza `assets/icon.png` y listo.

### ✅ Política de privacidad y soporte — resuelto el 2026-09-18

`/privacidad` y `/soporte` son páginas públicas del Next (`src/app/privacidad`,
`src/app/soporte`; el proxy las deja pasar sin sesión y `proxy.test.ts` lo
vigila). Lo que dice la política está verificado contra el código: correo (que
es el usuario), rol, tipo de perfil y preferencias; credenciales en Firebase
Authentication; sin analytics ni rastreo. **Si cambia qué se guarda, cambia la
página.**

### ✅ Borrado de cuenta (Guideline 5.1.1 v) — dos capas

Una app que permite crear cuenta tiene que permitir borrarla desde adentro.

- **Desde la app**: *Ajustes → Cuenta → Eliminar cuenta* llama a
  `DELETE /users/me` (backend PR #67), que borra la fila, las preferencias y la
  cuenta de Firebase. Hasta que ese PR esté desplegado el botón devuelve un
  error.
- **Además**, para 1.0.0 el bundle de iOS **no ofrece el alta**: el login no
  enlaza a `/signup` cuando `IS_BUNDLED`; la cuenta se crea en la web y entra
  igual. Cuando el borrado esté en producción y probado desde el bundle, ese
  ocultamiento se puede sacar.

### ✅ Cumplimiento de exportación y solo iPhone

`scripts/ios-store-settings.sh` pone `ITSAppUsesNonExemptEncryption=false` en
el Info.plist y `TARGETED_DEVICE_FAMILY=1` en el proyecto, en cada build (CI y
`pnpm cap:ios`), porque `ios/` se regenera. Solo iPhone evita las capturas de
iPad 13" y un layout más que defender; la app igual se instala en iPad.

### ✅ Resueltos

- **CORS** — el login desde `capacitor://localhost` funciona (ver
  `MOBILE_APP.md` §5). Verificado dentro de la app en el simulador.
- **Áreas seguras** — el header ya no queda debajo del reloj.
- **Router de assets** — el parche Swift resuelve el export estático de Next.

---

## 1 · Apple Developer Program

Cuenta paga, 99 USD al año. Si es a nombre personal alcanza; si va a nombre de
una organización, Apple pide un número D-U-N-S y eso demora semanas.

Anotá el **Team ID** (10 caracteres, en *Membership details*): es el secret
`IOS_TEAM_ID`.

---

## 2 · Identificador de la app

*developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → +*

- Tipo: **App IDs → App**
- Bundle ID: **explícito**, `com.ontimeai.app`
- Capabilities: **ninguna**. La app no usa push, ni iCloud, ni Sign in with
  Apple, ni background modes. Habilitar capabilities que no se usan obliga a
  declaraciones extra en el review sin ganar nada.

El bundle ID es permanente. Una vez publicado no se puede cambiar.

---

## 3 · Certificado de distribución

*Certificates → + → Apple Distribution*

1. Generá un CSR en el Mac: **Acceso a Llaveros → Asistente para certificados →
   Solicitar un certificado de una autoridad de certificación**, guardado a disco.
2. Subí el CSR, descargá el `.cer` y hacele doble clic para instalarlo.
3. En Acceso a Llaveros, exportá **el certificado junto con su clave privada**
   como `.p12` y ponele contraseña.

```bash
base64 -i distribucion.p12 | pbcopy   # → IOS_CERTIFICATE_P12_BASE64
```

La contraseña del `.p12` va en `IOS_CERTIFICATE_PASSWORD`.

> Sin la clave privada el `.p12` no sirve para firmar. Si al exportar solo te
> deja elegir el certificado y no aparece la llave debajo, el CSR se generó en
> otra máquina o en otro llavero.

---

## 4 · Perfil de provisión

*Profiles → + → App Store Connect* (distribución), asociado al App ID
`com.ontimeai.app` y al certificado del paso 3. Nombre: **`OnTimeAI App Store`**
— el workflow firma con el perfil *por nombre* (`IOS_PROFILE_NAME` en
`ios-release.yml`); si se crea con otro, hay que cambiarlo ahí.

> El proyecto que genera `cap add ios` viene con firma automática e identidad
> "iPhone Developer". En CI solo hay certificado de distribución, así que el
> archive y el export van con firma **manual** (`CODE_SIGN_STYLE=Manual`,
> `Apple Distribution`, este perfil). No hace falta ningún certificado de
> desarrollo.

```bash
base64 -i OnTimeAI_AppStore.mobileprovision | pbcopy   # → IOS_PROVISIONING_PROFILE_BASE64
```

El perfil **caduca al año**, y un perfil vencido hace fallar el `archive` con un
error de firma que no dice que se venció. Si el build empieza a fallar sin que
hayas tocado nada, revisá esto primero.

---

## 5 · Clave de API de App Store Connect

Es lo que permite subir el `.ipa` sin la contraseña de tu Apple ID.

*App Store Connect → Users and Access → Integrations → App Store Connect API → +*

- Rol: **App Manager** alcanza para subir builds. **Admin** hace falta si la
  misma clave va a crear el certificado y el perfil por API (pasos 3 y 4 sin
  pasar por la web).
- Descargá el `.p8`. **Se descarga una sola vez**; si lo perdés hay que revocar
  la clave y crear otra. Guardalo en `~/.private_keys/AuthKey_<KEY_ID>.p8`, que
  es donde `xcrun altool` lo busca.

Tres secrets:

| Secret | Dónde sale |
|---|---|
| `APPSTORE_API_KEY_ID` | el ID de la clave (10 caracteres) |
| `APPSTORE_API_ISSUER_ID` | el Issuer ID, arriba de la lista de claves (UUID) |
| `APPSTORE_API_PRIVATE_KEY` | el contenido completo del `.p8`, incluidas las líneas `BEGIN`/`END` |

---

## 6 · Registro de la app en App Store Connect

*Apps → + → New App*

- Plataforma: iOS
- Nombre: el de `PUBLICACION.md` §04 (único en toda la App Store)
- Idioma principal: Español (o Inglés, si vas a publicar afuera)
- Bundle ID: `com.ontimeai.app` (aparece solo si hiciste el paso 2)
- SKU: identificador interno tuyo, no se muestra. `ontimeai-ios` sirve.
- Acceso de usuario: acceso completo

Ahí mismo se cargan los metadatos, capturas y las respuestas de privacidad — todo
eso está en `PUBLICACION.md`.

---

## 7 · Compilar y subir

Con los siete secrets cargados en *GitHub → Settings → Secrets and variables →
Actions*:

| Secrets | Variables |
|---|---|
| `IOS_TEAM_ID` · `IOS_CERTIFICATE_P12_BASE64` · `IOS_CERTIFICATE_PASSWORD` · `IOS_PROVISIONING_PROFILE_BASE64` · `APPSTORE_API_KEY_ID` · `APPSTORE_API_ISSUER_ID` · `APPSTORE_API_PRIVATE_KEY` | `MOBILE_API_ORIGIN` · `MOBILE_APP_ORIGIN` |

*Actions → **iOS Release (TestFlight)** → Run workflow*

| Input | Qué poner |
|---|---|
| `version` | semver de tres números (`1.0.0`). Es la que ve App Store y la base que el servidor de OTA compara. El número de build lo pone el workflow (el del run), no hace falta tocarlo |
| `apiOrigin` / `appOrigin` | vacío usa las variables del repo |
| `ota` | `true` para el binario que va a la tienda (ver §10). Un binario con `false` nunca recibe OTAs |
| `subir` | `true` para que además lo mande a TestFlight |

El workflow verifica tres cosas antes de firmar, y las tres son fallas que de
otro modo aparecen recién en el teléfono o en el rechazo:

1. **Que el `.ipa` NO tenga `server.url`.** Es la comprobación que justifica todo
   el pipeline: un contenedor apuntando a una URL es el patrón de la 5.6.
2. **Que `ios.includePlugins` no se haya desincronizado de `package.json`.** Esa
   lista es una allowlist: un plugin instalado y no declarado simplemente no
   viaja, y el JS que lo use falla sin que el build avise.
3. **Que el bundle se sostenga solo** — orígenes inyectados, estilos presentes,
   sin rutas relativas a route handlers.

Sin los secrets el workflow no falla en falso: compila sin firmar, que alcanza
para verificar el bundle, los plugins y el parche del router.

### Local, si preferís Xcode

```bash
pnpm cap:ios     # bundle + config + sync + parche + abre Xcode
```

Después *Product → Archive* y *Distribute App*. El script restaura
`capacitor.config.ts` solo, incluso si algo falla en el medio.

---

## 8 · TestFlight

El build tarda entre 10 y 30 minutos en procesarse. Cuando aparece:

- **Testing interno** — hasta 100 miembros del equipo, sin revisión. Disponible
  en minutos. Es donde hay que probar antes de cualquier otra cosa.
- **Testing externo** — hasta 10.000 personas, pero pasa por **Beta App Review**
  (un día o dos). Ahí ya piden la cuenta de demostración.

**Probalo en un teléfono real antes de enviar a review.** El simulador no
reproduce la firma, ni el teclado del sistema, ni el rendimiento del WebView, ni
el comportamiento con la red intermitente.

Lo que hay que recorrer con la cuenta que le vas a dar al revisor:

- [ ] Login y logout
- [ ] Dashboard con datos reales
- [ ] Lista de vuelos, filtros y detalle de un vuelo
- [ ] Mapa con el fondo cargado
- [ ] Clima
- [ ] Que **ningún** ítem del menú lleve a una pantalla vacía o a un error

---

## 9 · Enviar a revisión

*App Store Connect → la versión → Add for Review → Submit*

Lo que decide el resultado, en orden de peso:

**La cuenta de demostración.** Toda la app está detrás de un login. Un revisor
sin credenciales ve la pantalla de acceso y rechaza. Cargala en *App Review
Information*, verificá que entra desde el build de TestFlight, y **que no sea
`superadmin`**: con rol `user` o `admin` alcanza para ver el producto y evita
exponer el panel de usuarios y las pantallas internas de `/tesis`. El rechazo de
Lia bajo 5.6 fue justamente porque la cuenta demo veía herramientas internas.

**Las notas de revisión.** Dos o tres frases: qué es (un trabajo de tesis que
predice retrasos de vuelos de Atlanta con un modelo de machine learning, con
datos reales), y que la interfaz viaja dentro del binario mientras los datos se
consultan por HTTPS. Eso último es lo que la separa del patrón que rechaza la
5.6.

**Cumplimiento de exportación.** Solo HTTPS estándar: exento. Ya está fijado en
cada build por `scripts/ios-store-settings.sh`, así que no lo pregunta.

**Tiempos.** La primera revisión suele tardar entre 24 y 48 horas. Un rechazo
llega por *Resolution Center* con la guideline citada.

### Si rechazan

1. Leé la guideline exacta, no la interpretación. El texto dice qué falta.
2. Respondé **en el Resolution Center**, no reenviando otro build a ciegas: si
   el problema es de metadatos o de la cuenta demo, un build nuevo no cambia
   nada y perdés otro ciclo.
3. Solo si es un problema de código, subí un build con `versionCode` mayor.
4. La apelación al App Review Board existe, pero conviene agotar el Resolution
   Center primero.

---

## 10 · Después de publicar

**Actualizaciones de interfaz sin review.** El Apple Developer Program License
Agreement §3.3.2 permite actualizar código interpretado (JS, CSS, HTML) sin pasar
por revisión. De eso se ocupa *Actions → iOS OTA*, y es lo que devuelve los
deploys rápidos que costó empaquetar los assets.

El servidor es **propio**, no hay cuenta de terceros ni costo: los bundles van a
un bucket de GCS (`gs://ontimeai-ota`) y la app pregunta a `/api/ota/updates`
del Next desplegado en Cloud Run, que decide con un manifest JSON del bucket.
Está verificado en el simulador de punta a punta (detección, descarga con
checksum, aplicación, `notifyAppReady`, rollback). Detalle en `MOBILE_APP.md` §7.

Lo que tiene que cumplirse:

1. **Que el binario instalado se haya compilado con `ota: true`.** Si el OTA
   está apagado en la app que la gente tiene, publicar un bundle no le llega a
   nadie. El `.ipa` de la tienda va siempre con `ota: true`.
2. **Que el Next desplegado tenga `/api/ota/updates`** — está en `main`, así
   que cualquier deploy posterior a ese merge lo trae.

**Cómo publicar.** *Actions → iOS OTA → Run workflow* con `accion: publicar`,
el `canal` y una `version` nueva (semver, única, mayor que la nativa: con
binario `1.0.0`, los bundles son `1.0.1`, `1.0.2`…). Una versión subida no se
puede reutilizar aunque se retire. La próxima release nativa sube el minor
(`1.1.0`) y los OTAs siguen desde ahí.

**Probar un OTA antes de tocar producción.** Publicá a `staging` (es el default
del workflow). Solo lo mira un binario compilado con `MOBILE_OTA_CHANNEL=staging`
—por ejemplo el que instalás en tu iPhone desde Xcode con `pnpm cap:ios`—; los
de la tienda no lo ven. Cuando esté bien, publicá la misma versión a
`production`... o mejor, corré `apuntar` con `canal: production` y esa versión:
el bundle ya está subido, solo cambia a quién se le ofrece.

**Rollback.** *Run workflow* con `accion: apuntar`, `canal: production` y la
versión anterior. Rige en el siguiente arranque de cada dispositivo: el manifest
se sirve sin caché.

**Lo que el OTA NO puede actualizar.** Cualquier cosa nativa: plugins de
Capacitor, permisos, el `Info.plist`, y el parche del router de assets. Todo eso
necesita una release nueva por el paso 7. Si un bundle empieza a usar un plugin
que un binario viejo no trae, publicalo con `minNative` = la primera versión
nativa que lo tiene, y el servidor no se lo ofrece a los anteriores.

**Red de seguridad.** Si un bundle nuevo no llama a `notifyAppReady()` en 10
segundos, el dispositivo vuelve solo al anterior — así un OTA malo no deja la
app tapiada. Y el plugin verifica el SHA-256 del zip contra el del manifest:
un archivo corrupto o cambiado se descarta.

---

## Resumen de qué crear y dónde

| # | Qué | Dónde | Resultado |
|---|---|---|---|
| 1 | Cuenta de desarrollador | developer.apple.com | `IOS_TEAM_ID` |
| 2 | App ID `com.ontimeai.app` | Identifiers | — (sin capabilities) |
| 3 | Certificado Apple Distribution | Certificates | `IOS_CERTIFICATE_P12_BASE64` + password |
| 4 | Perfil App Store Connect `OnTimeAI App Store` | Profiles | `IOS_PROVISIONING_PROFILE_BASE64` |
| 5 | Clave de API | ASC → Integrations | 3 secrets `APPSTORE_*` |
| 6 | Registro de la app | ASC → Apps | — |
| 7 | Build firmado | GitHub Actions | `.ipa` en TestFlight |
| 8 | Prueba en dispositivo | TestFlight | — |
| 9 | Envío a revisión | ASC | app publicada |
