# Auditoría y correcciones del frontend — 2026-08-09

## Alcance

Revisión funcional, semántica, de seguridad, rendimiento, accesibilidad y mantenibilidad del frontend OnTimeAI. También se extendió el backend para que el historial de cada vuelo incluya la explicación real guardada en cada ciclo.

## Correcciones implementadas

### 1. Seguridad y sesión

- Se eliminó el token de `localStorage` y la autenticación accesible desde JavaScript.
- Login y logout pasan por rutas same-origin que administran una cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción y con vencimiento de ocho horas.
- Se agregó un BFF en `/api/backend/*`; el token sólo se adjunta del lado servidor.
- Se valida el origen de requests mutables y se normaliza el destino posterior al login para impedir redirecciones abiertas o URLs ejecutables.
- El rol visible se obtiene de `/auth/me`, evitando confiar en contenido manipulable por el cliente y eliminando la diferencia de hidratación entre servidor y navegador.
- Se agregaron CSP y encabezados defensivos globales.
- Next.js y `eslint-config-next` quedaron actualizados a 16.3.0; `shadcn` pasó a dependencias de desarrollo.

### 2. Semántica de datos

- El gráfico horario compara porcentajes con porcentajes; antes mezclaba cantidad de vuelos con probabilidad y rotulaba todo como `%`.
- Los SHAP se muestran como contribuciones al score del booster, sin convertirlos incorrectamente en “puntos porcentuales”.
- Se muestra el valor observado de la feature cuando fue persistido.
- El mapa se presenta explícitamente como trayectoria/posición estimada. Un vuelo sin salida confirmada permanece en el aeropuerto de origen.
- Los faltantes meteorológicos permanecen como `null`/`—`; ya no se inventan `0 °F`, `0 kt` o `10 SM`.

### 3. Evolución histórica y SHAP por ciclo

El endpoint `GET /flight-history/{fa_flight_id}` ahora devuelve por ciclo:

- fecha de predicción;
- probabilidad base calibrada y probabilidad final;
- diferencia aplicada por ajustes operativos;
- predicción binaria, umbral, estrategia y fase;
- contexto GDP, demora de salida intermedia, ETA ADS-B y holding, cuando están disponibles;
- top-K SHAP persistido con feature, etiqueta, dirección, magnitud y valor observado.

La UI selecciona el último ciclo por defecto. Cada punto puede elegirse desde el gráfico o desde una lista horizontal accesible con teclado y adecuada para móvil. Al cambiar de ciclo se actualizan el resumen, la variación contra el ciclo anterior y sus SHAP reales.

Nota semántica: SHAP explica el score base del booster. La probabilidad base ya puede estar calibrada y luego recibir ajustes operativos; por eso la UI separa explícitamente probabilidad base, ajuste y probabilidad final.

### 4. Rendimiento y consistencia

- Mapa y tabla de `/flights` usan una única carga compartida.
- El refresh ocurre cada 60 segundos y conserva el snapshot previo durante la actualización.
- Estado, riesgo y búsqueda filtran ambos componentes.
- La tabla renderiza 25 filas por página en lugar de cientos simultáneamente.
- Se muestra hora de actualización, estado de refresco, errores recuperables y acción de reintento.
- Los filtros quedan reflejados en la URL.

### 5. Accesibilidad y UX

- Tabs y chips exponen estados `aria-selected`/`aria-pressed` y foco visible.
- Las rutas históricas se pueden seleccionar con Enter o Espacio.
- El acceso al detalle de vuelo permanece visible en touch y teclado; el número de vuelo también es un enlace.
- Se agregaron etiquetas a búsquedas, acciones administrativas y campos de formularios.
- Se reemplazaron `alert()` administrativos por notificaciones no bloqueantes.
- Se agregaron vistas globales de carga, recurso inexistente y error recuperable.
- El selector de perfil ahora aparece realmente en Ajustes para administradores; usuarios comunes siguen forzados a la vista pasajero.

### 6. Mantenibilidad y despliegue

- Se centralizaron errores, timeout, autenticación y redirección de sesión en el cliente de API.
- Se eliminó una ruta proxy duplicada que ocultaba errores devolviendo arrays vacíos.
- Se agregaron scripts de lint, typecheck, test y build, con Vitest para regresiones críticas.
- pnpm quedó fijado en 10.33.0 y la imagen Docker ejecuta el proceso final como usuario no root.
- `/api/weather` limita las estaciones aceptadas y rechaza listas inválidas o excesivas.

## Verificación ejecutada

- `pnpm lint`: sin errores ni warnings.
- `pnpm typecheck`: correcto.
- `pnpm test`: 10 pruebas aprobadas.
- `pnpm build`: build de producción correcto con 21 rutas generadas.
- `pnpm audit --prod`: sin vulnerabilidades conocidas.

## Riesgos o límites conocidos

- No existe `model_version` persistido por predicción histórica. La UI no inventa ese dato; si se necesita auditar cambios de artefacto por ciclo, debe agregarse una columna al esquema y escribirla en el harvester.
- La línea SHAP explica el modelo base, no los ajustes externos GDP/ADS-B. Ambos se muestran separados para evitar atribuir al booster una modificación operacional.
- El mapa no reemplaza una fuente de posición real. Para telemetría real se requiere exponer posiciones ADS-B con timestamp y calidad de señal desde backend.
- Las pruebas unitarias cubren regresiones de seguridad, faltantes meteorológicos y progreso estimado. La cobertura E2E completa requiere un entorno estable con backend y credenciales de prueba.
