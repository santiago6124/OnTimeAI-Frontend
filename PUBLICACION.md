# Ficha de publicación — OnTimeAI

Formulario para completar cada vez que subís un build nuevo a **Play Console** o
**App Store Connect**. Los valores marcados `← del repo` salen del código y no
hay que inventarlos; el resto lo completás vos en los bloques vacíos.

Copiá este archivo por release si querés dejar registro:
`cp PUBLICACION.md releases/2026-09-v1.0.md`

El detalle técnico de cómo se compila cada plataforma está en
[`MOBILE_APP.md`](MOBILE_APP.md).

---

## 00 · Antes de subir nada

Medido el 2026-09-06. El primero ya está resuelto; los otros dos siguen
abiertos y hay que resolverlos antes de enviar.

### ✅ iOS — el login ya funciona *(resuelto 2026-09-06)*

Era CORS: el bundle le habla al FastAPI desde `capacitor://localhost` y el
backend no tenía ese origen en su allowlist. Resuelto en dos lugares:

- **Vivo ahora**: la variable `ALLOWED_ORIGINS` del service `ontimeai-backend`
  en Cloud Run (revisión `00007-r8n`) ya incluye `capacitor://localhost`.
- **Durable**: la lista por defecto de `api.py` también, para que un deploy
  futuro sin esa variable no vuelva a romperlo.

Verificado dentro de la app real, no solo con `curl`: la app corriendo en el
simulador validó su token contra `/auth/me` desde `capacitor://localhost` y
trajo los 477 vuelos del día.

> ⚠️ La variable de entorno **tapa** el default del código. Si algún día sumás
> un origen nuevo en `api.py`, acordate de actualizar también la variable en
> Cloud Run, o el cambio no va a tener efecto en producción.

### 🔴 Web + Android — los mapas se ven sin fondo

Las capas base salen de `server.arcgisonline.com`, pero la CSP que sirve Cloud
Run solo permite `img-src … https://*.basemaps.cartocdn.com`. Los tiles quedan
bloqueados y el mapa dibuja los vuelos sobre un vacío gris.

En iOS empaquetado no pasa, porque un export estático no emite cabeceras.

Es una línea en `next.config.ts`: agregar `https://server.arcgisonline.com` a
`img-src`. Importa acá porque Android abre ese mismo sitio, así que un revisor de
Play ve la pantalla de mapa rota.

### 🔴 Android — no existe el keystore de release

Play Console rechaza un AAB firmado con la clave de debug.

```bash
keytool -genkey -v -keystore ontimeai.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias ontimeai
base64 -i ontimeai.jks | pbcopy   # → secret ANDROID_KEYSTORE_BASE64
```

Guardalo **fuera del repo y con backup**: perderlo significa no poder volver a
actualizar la app publicada.

Después cargá en GitHub los secrets `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`.

---

## 01 · Identidad y versión

Vale para las dos tiendas.

| Campo | Valor | |
|---|---|---|
| Bundle ID / applicationId | `com.ontimeai.app` | ← del repo · **permanente** |
| Nombre en el dispositivo | `OnTimeAI` | ← del repo |
| Origen del backend | `ontimeai-backend-871707213932.us-central1.run.app` | ← default de `build-mobile.mjs` |
| minSdk / target SDK (Android) | `23` / `35` | ← del repo |

### Versión que subís — `versionName` / `MARKETING_VERSION`

Hoy el repo dice `1.0`. Es la que ve el usuario. Subila en cada release que
quieras diferenciar.

```
1.0
```

### Build — `versionCode` / `CURRENT_PROJECT_VERSION`

Hoy el repo dice `1`. Entero, y **tiene que subir en cada subida** aunque la
versión no cambie: las dos tiendas rechazan un build repetido.

```

```

### Qué cambia en esta versión

Sirve para las dos: va en *Novedades* de Play y en *What's New* de App Store.
Escribilo desde el lado del usuario, no del commit. Máx. 500 caracteres en Play.

```

```

---

## 02 · Play Console — Ficha de tienda

*Crecimiento → Presencia en tienda → Configuración de la ficha principal*

### Nombre de la app — máx 30

Lo que se busca en Play. Puede llevar un descriptor corto.

```

```

### Descripción breve — máx 80

El texto que aparece antes de tocar "Más información". Es lo que más se lee.

```

```

### Descripción completa — máx 4000

Qué hace, para quién y con qué datos. Conviene decir que **requiere cuenta** y
que es un trabajo académico, para que nadie la instale esperando una app pública
de vuelos.

```

```

### Categoría y etiquetas

Sugerido: `Viajes y guías`, o `Productividad` si preferís marcarla como
herramienta interna.

```

```

### Email de contacto

Público en la ficha. Play lo exige.

```

```

### URL de política de privacidad

**Obligatoria** en las dos tiendas, y tiene que estar publicada y accesible
**sin login** antes de enviar. Si no tenés una, hay que escribirla: qué datos se
recogen (usuario y contraseña para autenticar), dónde se guardan y a quién se le
mandan.

```

```

### Gráficos

- Ícono — `512×512` PNG
- Gráfico destacado — `1024×500`
- Capturas de teléfono — entre 2 y 8, lado corto de 320 a 3840 px

Sacalas de un dispositivo o simulador **ya logueado**, mostrando datos reales.

```
(dónde están los archivos / qué falta)
```

---

## 03 · Play Console — Contenido de la app

*Política → Contenido de la app*

### Seguridad de los datos

El cuestionario más largo. Lo que corresponde declarar con el código de hoy:

- **Sí** se recogen credenciales de acceso (usuario y contraseña) para autenticar
- El token queda en el almacenamiento del dispositivo
- **No** hay analytics, publicidad ni rastreo
- **No** se recoge ubicación, contactos, cámara ni archivos
- El único permiso del manifiesto es `INTERNET`
- Los datos se transmiten cifrados (HTTPS)
- El usuario puede pedir la baja de su cuenta

```
(notas / decisiones que tomaste en el cuestionario)
```

### Clasificación de contenido

Cuestionario IARC. Sin violencia, sexo, drogas, apuestas ni contenido generado
por usuarios: sale "apta para todos". Ojo con la pregunta de *interacción entre
usuarios* — la respuesta es no.

```

```

### Público objetivo

Elegí solo rangos de **18+**. Marcar público infantil dispara Families Policy y
un montón de requisitos extra que no querés.

```

```

### App de acceso restringido

Play pregunta si el contenido está detrás de un login. Acá **sí**: hay que darles
credenciales de prueba, igual que a Apple. Usá las mismas de la sección 06.

```

```

### Track de publicación

Empezá por **Testing interno** (sale en minutos, hasta 100 correos). Play exige
un período de prueba cerrada antes de producción para cuentas nuevas de
desarrollador.

```

```

---

## 04 · App Store Connect — Información

*App Information + Version Information*

### Nombre — máx 30

Único en toda la App Store. Si "OnTimeAI" está tomado, hay que cambiarlo acá.

```

```

### Subtítulo — máx 30

Se lee debajo del nombre en los resultados. No repitas el nombre acá.

```

```

### Palabras clave — máx 100

Separadas por comas, **sin espacios** después de la coma (cuentan). No repitas
palabras que ya están en el nombre o el subtítulo.

```

```

### Descripción — máx 4000

Podés reutilizar la de Play. Dejá explícito que requiere cuenta y que es un
proyecto académico.

```

```

### Texto promocional — máx 170

El único campo que podés cambiar **sin** pasar por review. Útil para avisos
temporales.

```

```

### Categoría

Primaria y secundaria. Sugerido: `Travel` como primaria, `Productivity` como
secundaria.

```

```

### URL de soporte

**Obligatoria.** Una página que exista y explique cómo pedir ayuda. Puede ser el
README del repo si es público.

```

```

### Capturas

Obligatorias las de **iPhone 6.9"** (`1320×2868` o `1290×2796`). Si el listado
incluye iPad, también las de 13".

```bash
xcrun simctl io booted screenshot captura.png
```

```
(dónde están / qué falta)
```

---

## 05 · App Store Connect — Privacidad

### Datos que recoge la app

Con el código de hoy, lo honesto es declarar:

- **Identifiers → User ID** — vinculado a la identidad, usado para *App
  Functionality*, **no** usado para rastreo
- Nada más: sin ubicación, contactos, salud, compras, historial de navegación ni
  diagnósticos
- Marcá *"No, no recopilamos datos con fines de seguimiento"*

```
(qué declaraste exactamente)
```

### Cumplimiento de exportación

La app solo usa HTTPS estándar, así que califica para la exención. Se responde
una vez y conviene fijarlo en el `Info.plist` con
`ITSAppUsesNonExemptEncryption = false` para que no lo pregunte en cada subida.

```

```

### Clasificación por edad

Cuestionario propio de Apple, separado del de Play. Mismas respuestas: sin
contenido sensible.

```

```

---

## 06 · Información para el revisor

> **Toda la app está detrás de un login.** Un revisor sin credenciales ve una
> pantalla de acceso y nada más, y eso es rechazo automático. Este apartado
> decide si la revisión avanza o no.

### Usuario de demostración

Cuenta real y que funcione durante toda la revisión.

**Que no sea `superadmin`**: con rol `user` o `admin` alcanza para ver el
producto, y evita exponer el panel de usuarios y las pantallas internas de
`/tesis`. Lia fue suspendida bajo *Guideline 5.6* justo porque la cuenta demo
veía herramientas internas.

```

```

### Contraseña de demostración

Verificá que entra **desde la app compilada**, no solo desde la web.

```

```

### Notas para la revisión

Explicá en dos o tres frases qué es: un trabajo de tesis que predice retrasos de
vuelos del aeropuerto de Atlanta con un modelo de machine learning, con datos
reales.

Aclará que los assets de la interfaz viajan **dentro del binario** y que la app
solo consulta datos por HTTPS — es lo que la separa de un webview a una URL, el
patrón que rechaza la Guideline 5.6.

```

```

### Contacto

Nombre, apellido, teléfono y email por si el revisor necesita escribirte.
Contestá rápido: una consulta sin respuesta se convierte en rechazo.

```

```

---

## 07 · Antes de apretar enviar

- [x] **El CORS del backend acepta `capacitor://localhost`** — resuelto y
      verificado en el simulador el 2026-09-06 (bloqueador 00)
- [ ] **El build subió de número** — las dos tiendas rechazan un build repetido
- [ ] **Recorriste la app entera con la cuenta demo** — con el rol que le vas a
      dar al revisor, no con el tuyo; ningún botón puede llevar a una pantalla
      vacía o a un error
- [ ] **Los mapas muestran el fondo** — si se ven grises, falta el arreglo de la
      CSP; en iOS empaquetado funcionan, en Android no
- [ ] **El `.ipa` no tiene `server.url`** — lo verifica solo `ios-release.yml`;
      un shell apuntando a una URL es lo que Apple suspende
- [ ] **La política de privacidad está publicada y abre sin login** — las dos
      tiendas la verifican automáticamente
- [ ] **El AAB está firmado con el keystore de release** — no con la clave de
      debug, y el keystore tiene backup fuera del repo
- [ ] **Probaste el build desde TestFlight en un teléfono real** — el simulador
      no reproduce ni la firma, ni el teclado, ni el rendimiento del WebView

---

## Cómo se compila

| | Dónde | Qué produce |
|---|---|---|
| Android | *Actions → Android Build → Run workflow*, tipo `release` | AAB firmado |
| iOS | *Actions → iOS Release (TestFlight)* | `.ipa` firmado |
| OTA iOS | *Actions → iOS OTA (Capgo)* | bundle sin pasar por review |

Los tres verifican solos lo que puede salir mal en silencio: que el APK tenga
`server.url`, que el `.ipa` **no** lo tenga, y que los plugins declarados
coincidan con los instalados.

Local: `pnpm cap:android` y `pnpm cap:ios`.
