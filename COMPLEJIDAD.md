# Gate de complejidad ciclomática

Desde el 2026-10-22 el CI rechaza funciones nuevas con complejidad ciclomática
mayor a **10** en `src/`. Es el mismo mecanismo que el Backend tiene en
`scripts/complejidad.py`, con las herramientas de este repo. Este documento
explica qué mide, por qué ese umbral, qué quedó exento y cómo se achica la
deuda.

## Qué mide y con qué

La complejidad ciclomática (McCabe, 1976) cuenta los caminos independientes de
una función: 1 más una unidad por cada decisión. A más caminos, más casos de
prueba hacen falta para cubrirla y más fácil es que un cambio rompa un camino
que nadie ejercita.

La cuenta la hace la regla `complexity` de ESLint (variante clásica), ya
instalada con `eslint-config-next`, así que no hay dependencias nuevas. Suma
uno por cada `if`, `else if`, `for`, `for…in`, `for…of`, `while`, `do…while`,
`case`, `catch`, operador ternario, `&&`, `||`, `??`, encadenamiento opcional
`?.` y asignaciones lógicas (`||=`, `&&=`, `??=`). Cada función se mide por
separado: un callback dentro de un componente cuenta aparte del componente.

En un componente React eso significa que cada `cond && <X/>`, cada ternario en
el JSX y cada `?.` sobre props opcionales suman. Es intencional: son ramas que
la UI puede tomar y que una prueba tendría que cubrir.

Hay una sola herramienta en dos roles:

| Rol | Cómo | Qué hace |
|---|---|---|
| **gate** (bloquea) | `scripts/complejidad.mjs --check` | `complexity` a 10 con los comentarios `eslint-disable` apagados; compara contra la baseline |
| **lint** (bloquea) | `pnpm lint` | la misma regla a 10 en `eslint.config.mjs`; es lo que ve el editor |
| **reporte** (informa) | `--reporte` / `--resumen` | `complexity` a 0, así ESLint informa todas las funciones con su valor |

## Alcance

Sólo `src/`: lo que corre en el servidor de Next y en el navegador o el
WebView del usuario. `scripts/` (herramientas de build y publicación),
`mobile/` (reemplazos de páginas para el bundle de iOS, que se lintean cuando
`build-mobile.mjs` los copia a `.mobile/`) y los proyectos nativos quedan fuera.

## Umbral y baseline

Umbral 10, el clásico: hasta 10 la función es simple; de 11 a 20 moderada; más
de 20 compleja y difícil de probar exhaustivamente. El valor está en dos lugares
que tienen que coincidir: `UMBRAL` en `scripts/complejidad.mjs` y la regla
`complexity` de `eslint.config.mjs`.

Al instalar el gate había **36 funciones por encima de 10** entre las 1218 de
`src/`. Están en `.complejidad-baseline.json`, con el valor con el que
entraron. La baseline es un trinquete:

- una función nueva por encima de 10 **falla** el CI, aunque lleve un
  `eslint-disable`; el check corre con `allowInlineConfig: false` justamente
  para eso;
- una función exenta que **crece** por encima de su valor de entrada falla;
- una función exenta que baja de 10 se saca con `--actualizar-baseline`, que
  sólo acepta listas más chicas (sin claves nuevas ni valores mayores).

Las funciones exentas llevan, en la línea anterior,
`// eslint-disable-next-line complexity -- deuda registrada en .complejidad-baseline.json`
para que `pnpm lint` pase limpio; la marca no exime nada por sí sola.

### Cómo se identifica cada función

La clave de la baseline es `ruta relativa::nombre`, con el nombre que ESLint
pone en el mensaje: `src/components/cascada-card.tsx::CascadaCard`,
`src/app/api/ota/updates/route.ts::POST`. Las funciones sin nombre (arrow
functions, callbacks, `forwardRef`) se identifican por tipo y línea del `=>`:
`src/components/ui/chart.tsx::arrow@L202`. **Esa clave cambia si la función se
mueve de línea** aunque no cambie de contenido: el check la reporta como nueva
y hay que correr `--actualizar-baseline`, que la acepta porque la lista no
crece. Lo mismo pasa si dos funciones de un archivo comparten nombre: las dos
llevan la línea para no pisarse.

## Cómo se usa

```bash
node scripts/complejidad.mjs --check                    # lo mismo que corre CI
node scripts/complejidad.mjs --reporte complejidad.json --resumen resumen.md
node scripts/complejidad.mjs --actualizar-baseline      # tras bajar una función
```

En CI el paso "Complejidad ciclomática" corre antes que los tests, escribe el
resumen en la página del job (`$GITHUB_STEP_SUMMARY`) y sube `complejidad.json`
como artifact, también cuando falla.

## Cómo bajar una función

- **Componentes**: extraer sub-componentes con nombre propio por cada bloque
  condicional del JSX (`<EstadoVacio/>`, `<FilaCancelada/>`), y mover la
  lógica de derivación a hooks o funciones puras que se prueben solas.
- **Handlers de API** (`route.ts`): separar validación del cuerpo, autorización
  y efecto en funciones distintas; devolver temprano.
- **Cascadas de `if`/`switch` sobre un valor**: reemplazarlas por una tabla o
  un `Record` de despacho.
- **Encadenamientos `?.` y `??` repetidos**: normalizar el dato una vez al
  entrar, en lugar de defenderse en cada uso.
- Cubrir con tests **antes** de mover código. Las funciones más complejas de la
  lista (`CascadaCard`, `TestCasesViewer`) no tienen tests propios hoy.

## Deuda inicial (2026-10-22)

1218 funciones en `src/`, promedio 2,34. Distribución por rango (los de
radon, para comparar con el Backend): A (1–5) 1113, B (6–10) 69, C (11–20) 32,
D (21–30) 2, E (31–40) 2.

| Función | CC | Archivo |
|---|---|---|
| `CascadaCard` | 32 | `src/components/cascada-card.tsx:71` |
| `TestCasesViewer` | 31 | `src/app/tesis/pruebas/page.tsx:158` |
| `POST` | 23 | `src/app/api/ota/updates/route.ts:116` |
| arrow function | 22 | `src/components/ui/chart.tsx:202` |
| `PredictionEvolution` | 20 | `src/components/prediction-evolution.tsx:18` |
| `ReportsPage` | 19 | `src/app/reports/page.tsx:38` |
| `WeatherPage` | 19 | `src/app/weather/page.tsx:31` |
| `FlightsTableView`, `FlightRow` | 19 | `src/components/flights-table.tsx` |
| `flightToTrack` | 19 | `src/hooks/use-real-flight-tracks.ts:36` |
| `EndpointCard` | 18 | `src/app/tesis/pruebas/page.tsx:303` |
| `FlightDetailView` | 18 | `src/components/flight-detail-view.tsx:37` |
| `TesisWeatherPage` | 17 | `src/app/tesis/weather/page.tsx:18` |
| arrow function | 16 | `src/components/ui/chart.tsx:149` |
| `VerificacionView` | 16 | `src/components/verificacion-view.tsx:204` |
| `get` | 16 | `src/lib/api.ts:324` |
| `deriveImpact` | 16 | `src/lib/weather-api.ts:168` |
| `POST` | 15 | `src/app/api/auth/firebase/route.ts:23` |
| `POST` | 15 | `src/app/api/auth/google/route.ts:17` |
| arrow function | 14 | `src/components/cascada-card.tsx:247` |
| `SettingsPage` | 13 | `src/app/settings/page.tsx:42` |
| `ShapRow` | 13 | `src/components/shap-panel.tsx:187` |
| `DetalleViajero` | 13 | `src/components/viajero/detalle-viajero.tsx:22` |
| `mensajeDeError` | 13 | `src/lib/firebase.ts:99` |
| `UsersPage` | 12 | `src/app/admin/users/page.tsx:53` |
| `RouteHistoryChart` | 12 | `src/components/route-history-chart.tsx:18` |
| `ShapPanel` | 12 | `src/components/shap-panel.tsx:11` |
| `getPayloadConfigFromPayload` | 12 | `src/components/ui/chart.tsx:330` |
| `WeatherCardView` | 12 | `src/components/weather-card-view.tsx:75` |
| `nativeExchange` | 12 | `src/lib/api.ts:517` |
| `fetchMetars`, `parseVisibility` | 12 | `src/lib/weather-api.ts` |
| `MetricCardsView` | 11 | `src/components/metric-cards-view.tsx:87` |
| async arrow function | 11 | `src/components/providers/native-session-provider.tsx:47` |
| `Sidebar` | 11 | `src/components/ui/sidebar.tsx:152` |
| `deriveCondition` | 11 | `src/lib/weather-api.ts:150` |

`chart.tsx` y `sidebar.tsx` son componentes generados por shadcn/ui y después
adaptados; su deuda se hereda del generador y conviene bajarla cuando se los
vuelva a regenerar, no a mano.
