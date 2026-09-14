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

### 🔴 El ícono es el placeholder de Capacitor

Hoy `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` es el
logo de Capacitor: un rayo azul sobre una grilla. Es lo que genera
`npx cap add ios` y se instalaría tal cual. Una app con el ícono de su framework
se lee como inacabada, y es lo primero que ve el revisor.

En el repo hay un ícono real diseñado — `public/logo.png`, avión blanco sobre
degradado violeta — pero **no sirve tal cual**, por dos motivos:

| Problema | Por qué importa |
|---|---|
| Tiene canal alpha | Apple rechaza íconos con transparencia |
| Ya trae esquinas redondeadas, glow y margen sobre fondo oscuro | iOS aplica su propia máscara: quedaría un ícono chico flotando dentro de un cuadrado negro |

El ícono de iOS tiene que ser **a sangre**: 1024×1024, el arte llenando el
cuadrado completo, sin transparencia, sin esquinas redondeadas propias y sin
sombra. Estos pasos lo producen a partir de `logo.png`, y están probados:

```bash
# 1. Recortar al cuadrado del degradado, dejando fuera el glow y el margen
sips -c 700 700 public/logo.png --out /tmp/ic-crop.png

# 2. Llevar a 1024x1024
sips --resampleHeightWidth 1024 1024 /tmp/ic-crop.png --out /tmp/ic-1024.png

# 3. Aplanar el alpha. El paso por JPEG es lo que lo saca: sips no tiene una
#    opción para descartar el canal, y convertir a PNG directo lo conserva.
sips -s format jpeg -s formatOptions 100 /tmp/ic-1024.png --out /tmp/ic.jpg
sips -s format png /tmp/ic.jpg --out /tmp/AppIcon-512@2x.png

# 4. Verificar. Tiene que decir `hasAlpha: no` y 1024x1024.
sips -g pixelWidth -g pixelHeight -g hasAlpha /tmp/AppIcon-512@2x.png
```

> El paso 3 no es opcional ni cosmético. Sin el rodeo por JPEG el archivo sale
> con `hasAlpha: yes` y Apple lo rechaza — un `sips -s format png` sobre un PNG
> con transparencia la conserva.

Mirá el resultado antes de usarlo: las esquinas quedan blancas donde había
transparencia. La máscara de iOS es más redondeada que el arte, así que las
recorta, pero conviene confirmarlo en un dispositivo. Si querés cero riesgo,
ajustá el recorte del paso 1 (probá 660) o re-exportá el arte a sangre desde el
diseño original.

> `ios/` no está versionado: se regenera en cada build. Si vas a reemplazar el
> ícono de forma permanente, el archivo tiene que vivir en el repo y copiarse
> desde `scripts/ios-prepare.sh`, o el próximo `cap add ios` lo vuelve a pisar
> con el de Capacitor.

### 🔴 Falta la política de privacidad publicada

Obligatoria, y Apple verifica que la URL abra sin login. Sin eso no se puede
enviar. Contenido mínimo: que se recogen usuario y contraseña para autenticar,
que el token queda en el dispositivo, que no hay analytics ni rastreo, y cómo
pedir la baja de la cuenta.

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
`com.ontimeai.app` y al certificado del paso 3.

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

- Rol: **App Manager** alcanza para subir builds.
- Descargá el `.p8`. **Se descarga una sola vez**; si lo perdés hay que revocar
  la clave y crear otra.

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
| `apiOrigin` / `appOrigin` | vacío usa las variables del repo |
| `capgo` | `false` mientras no exista la cuenta de Capgo (ver §10) |
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

**Cumplimiento de exportación.** Solo HTTPS estándar: exento. Fijalo en el
`Info.plist` con `ITSAppUsesNonExemptEncryption = false` y deja de preguntarlo en
cada subida.

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
por revisión. De eso se ocupa *Actions → iOS OTA (Capgo)*, y es lo que devuelve
los deploys rápidos que costó empaquetar los assets.

Requisitos, los dos: una cuenta de Capgo con el secret `CAPGO_TOKEN`, y que el
binario instalado se haya compilado con `capgo: true`. Si el OTA está apagado en
la app que la gente tiene instalada, publicar un bundle no le llega a nadie.

**Lo que el OTA NO puede actualizar.** Cualquier cosa nativa: plugins de
Capacitor, permisos, el `Info.plist`, y el parche del router de assets. Todo eso
necesita una release nueva por el paso 7.

**Red de seguridad.** El upload corre con `--fail-on-incompatible`, que aborta si
el bundle usa plugins nativos que la versión instalada no tiene. Y si un bundle
nuevo no llama a `notifyAppReady()` en 10 segundos, el dispositivo vuelve solo al
anterior — así un OTA malo no deja la app tapiada.

---

## Resumen de qué crear y dónde

| # | Qué | Dónde | Resultado |
|---|---|---|---|
| 1 | Cuenta de desarrollador | developer.apple.com | `IOS_TEAM_ID` |
| 2 | App ID `com.ontimeai.app` | Identifiers | — |
| 3 | Certificado Apple Distribution | Certificates | `IOS_CERTIFICATE_P12_BASE64` + password |
| 4 | Perfil App Store Connect | Profiles | `IOS_PROVISIONING_PROFILE_BASE64` |
| 5 | Clave de API | ASC → Integrations | 3 secrets `APPSTORE_*` |
| 6 | Registro de la app | ASC → Apps | — |
| 7 | Build firmado | GitHub Actions | `.ipa` en TestFlight |
| 8 | Prueba en dispositivo | TestFlight | — |
| 9 | Envío a revisión | ASC | app publicada |
