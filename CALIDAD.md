# Quality gate del Frontend

Desde el 2026-10-23 el CI de este repo corta por cuatro cosas además de los
tests, el typecheck, el lint y el bundle móvil: complejidad ciclomática (ver
`COMPLEJIDAD.md`), duplicación de código, cobertura total con trinquete y
cobertura sobre las líneas que cambia cada PR. Es el mismo quality gate que el
Backend tiene en Python, con las herramientas de este repo y sin depender de
un servicio externo. Este documento dice qué mide cada gate, con qué umbral,
qué valor tenía al instalarlo y cómo correrlo en la máquina de uno.

## Los gates

| Gate | Herramienta | Umbral | Valor al instalar (2026-10-22) |
|---|---|---|---|
| Bugs críticos | `pnpm typecheck` + `pnpm lint` (`eslint-config-next`) | 0 errores | 0 |
| Complejidad ciclomática | `scripts/complejidad.mjs --check` | ninguna función nueva > 10; baseline sólo achica | 36 exentas |
| Duplicación | `jscpd` 4 sobre `src/` sin tests | ≤ 5 % de líneas | 1,27 % (334/26.399 líneas, 23 clones) |
| Cobertura total | `vitest --coverage` (v8) sobre `src/` | trinquete ≥ 17 % líneas, 13 % ramas, 10 % funciones, 17 % sentencias; sólo sube | 17,6 / 13,7 / 10,2 / 17,2 % |
| Cobertura del código nuevo | `diff-cover` sobre el lcov de vitest | ≥ 80 % de las líneas cambiadas en el PR | se mide en cada PR |

Todo corre en el job `checks` de `.github/workflows/ci.yml`, en cada PR y en
cada push a `main`. El resumen del job (`$GITHUB_STEP_SUMMARY`) muestra la
complejidad, la cobertura, la duplicación y el detalle de diff-cover; los
reportes quedan como artifacts (`complejidad` y `calidad`).

### Bugs críticos

No hay una herramienta aparte: `tsc` y ESLint con `eslint-config-next` ya
tratan como **error** lo que rompe en tiempo de ejecución (hooks fuera de las
reglas, componentes sin `key`, props duplicadas, identificadores sin declarar
en JSX, `setState` en render, imports de `next/document` fuera de lugar), y
como *warning* lo que es estilo o rendimiento (`<img>`, dependencias de
hooks, variables sin usar). Un warning no corta; un error sí. Es deliberado no
agregar reglas propias más allá de `complexity`: la lista de errores la
mantiene el equipo de Next y acompaña cada versión del framework.

### Duplicación

`jscpd` busca fragmentos repetidos de al menos 5 líneas y 50 tokens en los
`.ts`/`.tsx` de `src/`, sin los `__tests__/` (los tests repiten
arrange/assert a propósito). Más de 5 % de líneas duplicadas corta el
pipeline. Los parámetros son los del Backend. Al instalarlo había 23 clones,
casi todos entre pares de componentes gemelos (`model-phase-chart` /
`model-quality-chart`, `flight-detail-view` / `prediction-evolution`) y los
helpers de `src/lib/api.ts`; es deuda a bajar, no a excluir.

jscpd cuenta los `.tsx` dos veces (como `tsx` y como `javascript`), por eso
el total de líneas de su tabla es mayor que el de `src/`. El porcentaje es
comparable igual.

### Cobertura total: el trinquete

`@vitest/coverage-v8` mide líneas, ramas, funciones y sentencias de **todo**
`src/` (`coverage.include`), incluidos los archivos que ningún test importa,
sin los tests ni los `.d.ts`. Los umbrales viven en `vitest.config.mts`
(`coverage.thresholds`) y son un trinquete: el total no puede bajar de ahí,
y cuando sube se suben, siempre al entero inmediatamente inferior al valor
medido. Línea de base del 2026-10-22 sobre `origin/main`: 17,6 % líneas, 13,7
% ramas, 10,2 % funciones, 17,2 % sentencias; umbrales 17, 13, 10 y 17.

Es un piso bajo a conciencia. La mayor parte de `src/` son páginas y
componentes de React que hoy no tienen tests; el gate no exige cubrirlos de
golpe, exige que la cobertura no retroceda y que lo nuevo venga cubierto (el
gate siguiente). Cada vez que un PR la sube de forma apreciable, se suben los
umbrales en el mismo PR.

El alcance es el mismo que el del gate de complejidad: sólo `src/`. Las
herramientas de `scripts/` quedan afuera del porcentaje para que no lo
inflen (un script chico y muy probado sumaría más de un punto), aunque tengan
tests propios, como `scripts/calidad-resumen.mjs`.

### Cobertura del código nuevo

`diff-cover` cruza el `coverage/lcov.info` del paso anterior con el diff del
PR contra su rama base y exige que al menos el 80 % de las líneas cambiadas
(de archivos que están en el reporte, o sea de `src/`) estén cubiertas. Un PR
que sólo toca archivos fuera de `src/` pasa sin medir nada. Corre sólo en
`pull_request`: en `main` no hay contra qué comparar. Es el gate que hace
crecer el trinquete sin obligar a nadie a testear código ajeno.

## Cómo se corre en local

```bash
pnpm typecheck && pnpm lint                   # bugs críticos
node scripts/complejidad.mjs --check          # complejidad
npx --yes jscpd@4 --min-tokens 50 --min-lines 5 --threshold 5 \
  --format typescript,tsx --reporters console,json --output jscpd \
  --ignore "src/**/__tests__/**" src          # duplicación
pnpm test:cov                                 # tests + cobertura con trinquete
```

Para la cobertura del código nuevo hace falta Python (`pip install
diff-cover==10.6.0`) y haber corrido `pnpm test:cov`:

```bash
git fetch origin main
diff-cover coverage/lcov.info --compare-branch=origin/main --fail-under=80
```

El resumen que ve CI se arma con
`node scripts/calidad-resumen.mjs --salida resumen.md` (lee lo que exista de
`coverage/coverage-summary.json`, `jscpd/jscpd-report.json` y
`diff-cover.md`; no falla si falta alguno). `coverage/`, `jscpd/` y
`diff-cover.md` están en `.gitignore`.

## Cómo se instaló

El PR que instaló los gates hizo dos commits a propósito: el primero con los
umbrales del trinquete un punto por encima de la cobertura real, para que el
run de CI fallara en "Tests con cobertura" y quedara la evidencia de que
corta; el segundo con los valores correctos. Es la misma secuencia
rojo → verde que se usó para el gate de complejidad y para el quality gate
del Backend.

## Defectos

Los defectos se cargan con el formulario "Defecto" de GitHub
(`.github/ISSUE_TEMPLATE/defecto.yml`), que pide severidad, entorno, pasos,
resultado esperado y obtenido, el requisito y el caso de prueba que lo cubre.
La plantilla de PR (`.github/PULL_REQUEST_TEMPLATE.md`) pide el test de
regresión que falla en el commit padre y pasa en el fix.
