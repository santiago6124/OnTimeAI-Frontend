# Ficha de publicación — OnTimeAI

Formulario para completar cada vez que subís un build nuevo a **Play Console** o
**App Store Connect**. Los valores marcados `← del repo` salen del código y no
hay que inventarlos; el resto lo completás vos en los bloques vacíos.

Copiá este archivo por release si querés dejar registro:
`cp PUBLICACION.md releases/2026-09-v1.0.md`

El **procedimiento** de iOS —qué crear en cada consola, certificados, TestFlight,
review— está en [`PUBLICACION-IOS.md`](PUBLICACION-IOS.md). El detalle técnico de
cómo se compila cada plataforma, en [`MOBILE_APP.md`](MOBILE_APP.md).

---

## 00 · Antes de subir nada

Medido el 2026-09-06; los tres quedaron resueltos el 2026-09-18. Se dejan
escritos porque explican decisiones que siguen en el código.

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

### ✅ Web + Android — los mapas se ven sin fondo *(resuelto 2026-09-18)*

Las capas base salen de `server.arcgisonline.com`, pero la CSP que servía Cloud
Run solo permitía `img-src … https://*.basemaps.cartocdn.com` (un origen que ya
no usaba nadie). `next.config.ts` ahora permite Esri, y
`src/__tests__/csp.test.ts` lo exige. En iOS empaquetado nunca pasó, porque un
export estático no emite cabeceras.

### ✅ Android — keystore de release *(resuelto 2026-09-18)*

Generado con OpenSSL (no hay JDK en la Mac): PKCS12, RSA 4096, alias `upload`,
válido hasta 2056. Vive en `~/.ontimeai/android-upload.p12` con su contraseña
al lado en `android-upload.password`. **Hacele backup en un gestor de
contraseñas**: como la app usa Play App Signing, perder esta clave se arregla
pidiendo un reset a Google, pero es un trámite de días.

Los secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD` los carga
`~/.ontimeai/configurar-android.sh` (un solo uso).

### ✅ Política de privacidad *(resuelto 2026-09-18)*

`/privacidad` (y `/soporte`), públicas (`PUBLIC_ROUTES` de `src/proxy.ts`,
vigilado por `proxy.test.ts`) y dentro del bundle de iOS. Enlazadas desde
login, alta y Ajustes. El texto sale de lo que la app hace de verdad; si cambia
algo de eso (analytics, permisos, otro proveedor), se cambia la página y su
fecha.

### ✅ Baja de cuenta desde la app *(2026-09-18)*

Las dos tiendas la exigen cuando la app permite crear cuentas (App Store 5.1.1,
Play "Account deletion"). *Ajustes → Cuenta → Eliminar cuenta* llama a
`DELETE /users/me` (backend #67, desplegado), que borra la fila, las
preferencias y la cuenta de Firebase. Para lo último el service account de
Cloud Run (`871707213932-compute@…`) tiene `roles/firebaseauth.admin` desde el
2026-09-18; sin ese rol la fila se borra igual pero la cuenta de Firebase
queda (probado: se quitó el rol y dejó de borrarla). Verificado en producción
con una cuenta descartable: 204, `/auth/me` pasa a 401 y el correo desaparece
de Firebase Authentication.

### ⚠️ Pendiente — migrar a Capacitor 8

Play exige `targetSdk 36` desde el 31/08/2026. Capacitor 7 soporta oficialmente
35; el proyecto compila con 36 igual (`android/variables.gradle`, AGP 8.9.3)
porque en Android es un WebView remoto sin código nativo propio. La migración a
Capacitor 8 —que trae 36 de fábrica— exige Xcode 26 en CI (`macos-26`), Node 22,
el plugin de OTA en su versión 8 y volver a verificar iOS. Conviene hacerla
después de la primera publicación, no antes.

---

## 01 · Identidad y versión

Vale para las dos tiendas.

| Campo | Valor | |
|---|---|---|
| Bundle ID / applicationId | `com.ontimeai.app` | ← del repo · **permanente** |
| Nombre en el dispositivo | `OnTimeAI` | ← del repo |
| Origen del backend | `ontimeai-backend-871707213932.us-central1.run.app` | ← default de `build-mobile.mjs` |
| minSdk / target SDK (Android) | `23` / `36` | ← del repo |

### Versión que subís — `versionName` / `MARKETING_VERSION`

Es la que ve el usuario. Subila en cada release que quieras diferenciar.

- **iOS**: la fija el input `version` de *iOS Release (TestFlight)*. Semver de
  tres números (`1.0.0`, no `1.0`): el servidor de OTA la usa de base y exige
  ese formato. Los bundles OTA van `1.0.1`, `1.0.2`…; la siguiente release
  nativa sube el minor (`1.1.0`).
- **Android**: la fija el input `version` de *Android Build* (semver, igual
  que iOS). Sin el input, un build local queda en `1.0`.

```
1.0.0 — primera versión en las dos tiendas
```

### Build — `versionCode` / `CURRENT_PROJECT_VERSION`

Entero, y **tiene que subir en cada subida** aunque la versión no cambie: las
dos tiendas rechazan un build repetido.

- **iOS**: lo pone el workflow solo — es el número del run de Actions. No hay
  que tocarlo; anotá acá el que salió.
- **Android**: también el número del run de *Android Build*. Un build local
  queda en `1`, que Play no acepta.

```
iOS: (run de iOS Release)   Android: 5 (run #5, 2026-09-18, en internal)
```

### Qué cambia en esta versión

Sirve para las dos: va en *Novedades* de Play y en *What's New* de App Store.
Escribilo desde el lado del usuario, no del commit. Máx. 500 caracteres en Play.

```
Primera versión: predicción de retrasos para los vuelos del día en Atlanta,
detalle por vuelo, mapa, meteorología en vivo y puntualidad por ruta.
```

---

## 02 · Play Console — Ficha de tienda

*Crecimiento → Presencia en tienda → Configuración de la ficha principal*

> Los textos de esta sección, el ícono, el gráfico y las capturas los carga
> `scripts/play-listing.mjs` desde `store/android/` (ver cabecera del script).
> El JSON `store/android/listing.es-419.json` es lo que se sube; si cambiás un
> texto acá, cambialo ahí.

### Nombre de la app — máx 30

Lo que se busca en Play. Puede llevar un descriptor corto.

```
OnTimeAI
```

### Descripción breve — máx 80

El texto que aparece antes de tocar "Más información". Es lo que más se lee.

```
Predicción de retrasos de vuelos en Atlanta con machine learning.
```

### Descripción completa — máx 4000

Qué hace, para quién y con qué datos. Conviene decir que **requiere cuenta** y
que es un trabajo académico, para que nadie la instale esperando una app pública
de vuelos.

```
OnTimeAI predice qué vuelos del aeropuerto Hartsfield-Jackson de Atlanta (ATL) van a llegar con más de 15 minutos de demora, con hasta 4 horas de anticipación.

Es un proyecto de tesis de grado. El modelo está entrenado con cuatro años de vuelos reales y se actualiza cada 15 minutos con datos operativos y meteorológicos en vivo.

QUÉ PODÉS VER
• Los vuelos del día con su riesgo de retraso: bajo, medio o alto
• El detalle de cada vuelo: horarios programados y estimados, probabilidad de retraso y qué factores pesaron en la predicción
• Un mapa con las trayectorias estimadas de los vuelos activos
• Meteorología en vivo de ATL y de los aeropuertos de origen (METAR de AWC/NOAA)
• Puntualidad histórica por ruta

PARA QUIÉN
• Viajeros que quieren saber si su vuelo desde o hacia Atlanta se va a retrasar
• Personas de operaciones que monitorean el aeropuerto o su flota

REQUIERE CUENTA
La app pide crear una cuenta con correo y contraseña. No tiene publicidad, analítica ni rastreo; qué se guarda y por qué está en la política de privacidad.

Cubre solo el aeropuerto de Atlanta (ATL). Las predicciones son estimaciones estadísticas y no reemplazan la información oficial de la aerolínea.
```

### Categoría y etiquetas

Sugerido: `Viajes y guías`, o `Productividad` si preferís marcarla como
herramienta interna.

```
Viajes y guías. Sin etiquetas.
```

### Email de contacto

Público en la ficha. Play lo exige.

```
santiagocarranzazinny@gmail.com — el mismo de la cuenta de desarrollador y de /privacidad
```

### URL de política de privacidad

**Obligatoria** en las dos tiendas, y tiene que estar publicada y accesible
**sin login** antes de enviar.

```
https://ontimeai-frontend-871707213932.us-central1.run.app/privacidad
```

### Gráficos

- Ícono — `512×512` PNG
- Gráfico destacado — `1024×500`
- Capturas de teléfono — entre 2 y 8, lado corto de 320 a 3840 px

Sacalas de un dispositivo o simulador **ya logueado**, mostrando datos reales.

```
store/android/icon-512.png · store/android/feature-1024x500.png
store/android/screenshots/01-live … 06-rutas (1170×2340)
Se regeneran con `node scripts/store-assets.mjs` (ver cabecera del script).
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
- La baja existe dentro de la app (Ajustes → Cuenta) y por correo (/privacidad)

```
Recoge datos: Sí.
  Información personal → Dirección de correo electrónico: obligatoria, no se
  comparte, se usa para "Funcionalidad de la app" y "Gestión de la cuenta".
  Información personal → ID de usuario: ídem (el usuario es el correo).
  Ningún otro tipo (ni ubicación, ni actividad, ni identificadores del
  dispositivo: el id aleatorio del chequeo OTA es solo de iOS).
Se cifra en tránsito: Sí.
Se puede pedir la eliminación: Sí — en la app y en
  https://ontimeai-frontend-871707213932.us-central1.run.app/privacidad
```

### Clasificación de contenido

Cuestionario IARC. Sin violencia, sexo, drogas, apuestas ni contenido generado
por usuarios: sale "apta para todos". Ojo con la pregunta de *interacción entre
usuarios* — la respuesta es no.

```
Categoría: "Utilidad, productividad, comunicación u otros". Todo No.
```

### Público objetivo

Elegí solo rangos de **18+**. Marcar público infantil dispara Families Policy y
un montón de requisitos extra que no querés.

```
Solo "18 años o más". No atrae a menores sin querer: No.
```

### App de acceso restringido

Play pregunta si el contenido está detrás de un login. Acá **sí**: hay que darles
credenciales de prueba, igual que a Apple. Usá las mismas de la sección 06.

```
"Toda la funcionalidad o parte está restringida" → Agregar instrucciones:
  usuario y contraseña de ~/.ontimeai/revisor-tiendas.txt.
  Nota: "Crear una cuenta también funciona (pide verificar el correo)."
```

### Track de publicación

Empezá por **Testing interno** (sale en minutos, hasta 100 correos). Play exige
un período de prueba cerrada antes de producción para cuentas nuevas de
desarrollador.

```
1. internal — ✅ 2026-09-18: 1.0.0 (5), AAB del run #5 de Android Build,
   subido con scripts/play-upload.mjs. La ficha (textos, ícono, gráfico y 6
   capturas) cargada con scripts/play-listing.mjs el mismo día.
2. alpha (prueba cerrada) — 12 testers opt-in durante 14 días, requisito de
   Play para cuentas personales nuevas. Es el camino crítico del calendario.
   Promover desde la consola o con play-upload.mjs --track alpha.
3. production — recién después de "Solicitar acceso a producción".
```

---

## 04 · App Store Connect — Información

*App Information + Version Information*

### Nombre — máx 30

Único en toda la App Store. Si "OnTimeAI" está tomado, hay que cambiarlo acá.

```
OnTimeAI
```

### Subtítulo — máx 30

Se lee debajo del nombre en los resultados. No repitas el nombre acá.

```
Predicción de retrasos en ATL
```

### Palabras clave — máx 100

Separadas por comas, **sin espacios** después de la coma (cuentan). No repitas
palabras que ya están en el nombre o el subtítulo.

```
vuelos,aeropuerto,atlanta,demora,delay,machine learning,aerolínea,pasajero,clima,tesis
```

### Descripción — máx 4000

Podés reutilizar la de Play. Dejá explícito que requiere cuenta y que es un
proyecto académico.

```
OnTimeAI predice la probabilidad de que un vuelo que sale del aeropuerto de Atlanta (ATL) llegue con retraso, usando un modelo de aprendizaje automático entrenado con datos públicos de operaciones aéreas y de clima.

QUÉ HACE

• Lista de vuelos programados de ATL con su probabilidad de retraso, actualizada cada 15 minutos.
• Detalle de cada vuelo: horario programado y estimado, aeronave, ruta y nivel de riesgo.
• Mapa de rutas y vista del clima en el aeropuerto.
• Dos perfiles: aerolínea, con métricas operativas por ruta y hora; y pasajero, con lo necesario para seguir un vuelo.
• Puntualidad histórica por ruta: qué porcentaje de cada ruta llegó a horario y con cuánta demora promedio.

QUÉ ES

Un trabajo final de carrera. No es un producto comercial: no hay publicidad, no se vende nada y no se comercializan datos. El código es abierto.

QUÉ NECESITÁS

Una cuenta. La app funciona con sesión iniciada; la cuenta se crea con correo y contraseña desde la web del proyecto, y el mismo acceso sirve en el teléfono.

Las predicciones son estimaciones estadísticas y pueden equivocarse. No reemplazan la información oficial de tu aerolínea ni del aeropuerto.
```

### Texto promocional — máx 170

El único campo que podés cambiar **sin** pasar por review. Útil para avisos
temporales.

```
Trabajo de tesis: predicciones de retraso para los vuelos que salen de Atlanta, actualizadas cada 15 minutos con datos reales.
```

### Categoría

Primaria y secundaria. Sugerido: `Travel` como primaria, `Productivity` como
secundaria.

```
Primaria: Travel
Secundaria: Productivity
```

### URL de soporte

**Obligatoria.** Una página que exista y explique cómo pedir ayuda. Puede ser el
README del repo si es público.

```
https://ontimeai-frontend-871707213932.us-central1.run.app/soporte

(y la de privacidad: https://ontimeai-frontend-871707213932.us-central1.run.app/privacidad)
```

### Capturas

Obligatorias las de **iPhone 6.9"** (`1320×2868` o `1290×2796`). Si el listado
incluye iPad, también las de 13".

```
iPhone 6.9" (1320×2868), generadas en el simulador de iPhone 17 Pro Max desde el build
de TestFlight con la cuenta demo. Solo iPhone: el binario declara TARGETED_DEVICE_FAMILY=1
(scripts/ios-store-settings.sh), así que iPad no aparece en el listado y no pide capturas.
```

```
store/ios/screenshots/02-dashboard … 06-rutas (1320×2868, iPhone 6,9").
Sin /live: el bundle de iOS no la incluye. Sin iPad: el listado es solo iPhone.
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
Contact Info → Email Address: sí. Vinculado a la identidad. Uso: App Functionality. No para rastreo.
Identifiers → User ID: sí (la cuenta). Vinculado a la identidad. Uso: App Functionality. No para rastreo.
Nada más. "¿Usan datos para rastrear?": No.

Motivo: la tabla `users` guarda correo (= usuario), rol, tipo de perfil y preferencias
visuales. Las credenciales las administra Firebase Authentication. No hay SDK de
analítica, publicidad ni crash reporting en el árbol.
```

### Cumplimiento de exportación

La app solo usa HTTPS estándar, así que califica para la exención. Se responde
una vez y conviene fijarlo en el `Info.plist` con
`ITSAppUsesNonExemptEncryption = false` para que no lo pregunte en cada subida.

```
Exento (solo HTTPS estándar). ITSAppUsesNonExemptEncryption=false lo pone
scripts/ios-store-settings.sh en cada build, así que no lo pregunta al subir.
```

### Clasificación por edad

Cuestionario propio de Apple, separado del de Play. Mismas respuestas: sin
contenido sensible.

```
4+. Sin contenido sensible en ninguna categoría del cuestionario.
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
store.reviewer@ontimeai.app — rol user, perfil operaciones ("aerolínea", el
que más pantallas muestra), correo verificado en Firebase a mano (el dominio
no recibe correo). Creada el 2026-09-18. Sirve para las dos tiendas.
```

### Contraseña de demostración

Verificá que entra **desde la app compilada**, no solo desde la web.

```
En ~/.ontimeai/revisor-tiendas.txt. No va en este archivo.
```

### Notas para la revisión

Explicá en dos o tres frases qué es: un trabajo de tesis que predice retrasos de
vuelos del aeropuerto de Atlanta con un modelo de machine learning, con datos
reales.

Aclará que los assets de la interfaz viajan **dentro del binario** y que la app
solo consulta datos por HTTPS — es lo que la separa de un webview a una URL, el
patrón que rechaza la Guideline 5.6.

```
OnTimeAI es un trabajo final de carrera universitario. Predice la probabilidad de retraso de los vuelos que salen del aeropuerto de Atlanta (ATL) con un modelo de machine learning entrenado con datos públicos de operaciones y clima, y muestra vuelos reales actualizados cada 15 minutos.

La interfaz viaja dentro del binario; la app solo consulta datos por HTTPS a nuestro backend. No es un contenedor web apuntando a una URL.

Toda la app requiere sesión. Ingresá con la cuenta de demostración indicada arriba (correo y contraseña en la pantalla "Ingresar"). La cuenta tiene el perfil "aerolínea", que muestra todas las pantallas del producto. El alta de cuentas se hace desde la web del proyecto; la app no la ofrece.

Política de privacidad: https://ontimeai-frontend-871707213932.us-central1.run.app/privacidad
Soporte: https://ontimeai-frontend-871707213932.us-central1.run.app/soporte
```

### Contacto

Nombre, apellido, teléfono y email por si el revisor necesita escribirte.
Contestá rápido: una consulta sin respuesta se convierte en rechazo.

```
Santiago Carranza · santiagocarranzazinny@gmail.com · teléfono: (completar)
```

---

## 07 · Antes de apretar enviar

- [x] **El CORS del backend acepta `capacitor://localhost`** — resuelto y
      verificado en el simulador el 2026-09-06 (bloqueador 00)
- [ ] **El build subió de número** — las dos tiendas rechazan un build repetido
- [ ] **Recorriste la app entera con la cuenta demo** — con el rol que le vas a
      dar al revisor, no con el tuyo; ningún botón puede llevar a una pantalla
      vacía o a un error
- [x] **Los mapas muestran el fondo** — CSP arreglada el 2026-09-18 y cubierta
      por test
- [ ] **El `.ipa` no tiene `server.url`** — lo verifica solo `ios-release.yml`;
      un shell apuntando a una URL es lo que Apple suspende
- [x] **La política de privacidad está publicada y abre sin login** —
      `/privacidad` y `/soporte`, desde el 2026-09-18 (salen con el deploy)
- [x] **El AAB está firmado con el keystore de release** — verificado en el
      run #5 (huella SHA-256 del certificado = la del keystore local). Falta
      el backup del keystore fuera de la Mac
- [x] **La cuenta se puede eliminar desde la app** — backend #67 desplegado y
      probado en producción el 2026-09-18
- [ ] **Probaste el build desde TestFlight en un teléfono real** — el simulador
      no reproduce ni la firma, ni el teclado, ni el rendimiento del WebView

---

## Cómo se compila

| | Dónde | Qué produce |
|---|---|---|
| Android | *Actions → Android Build → Run workflow*, tipo `release`, `version`, y `subir` para dejarlo en una pista de Play | AAB firmado (y subido) |
| iOS | *Actions → iOS Release (TestFlight)* | `.ipa` firmado |
| OTA iOS | *Actions → iOS OTA* | bundle sin pasar por review, al bucket propio |

Los tres verifican solos lo que puede salir mal en silencio: que el APK tenga
`server.url`, que el `.ipa` **no** lo tenga, y que los plugins declarados
coincidan con los instalados.

Local: `pnpm cap:android` y `pnpm cap:ios`.
