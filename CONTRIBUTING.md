# Contributing — OnTimeAI Frontend

## Branching model

Usamos **GitHub Flow** con números de issue en el nombre de la rama.
`main` es siempre deployable. Integración via Pull Requests únicamente.

### Tipos de rama

| Prefijo | Cuándo usarlo | Ejemplo |
|---|---|---|
| feature/ISSUE-desc | Nueva funcionalidad | feature/2-alertas-vuelos |
| fix/ISSUE-desc | Bug en producción | fix/7-flash-login |
| docs/desc | Solo documentación | docs/branching-model |
| chore/desc | Mantenimiento / deps | chore/update-next-16 |

Reglas:
- Partir siempre de main actualizado
- Un issue = una rama = un PR
- Sin commits directos a main
- Squash merge al cerrar el PR

## Commits — Conventional Commits

feat(flights): add sortable columns to flights table
fix(auth): redirect to intended page after session expiry
docs: update contributing guide
chore(deps): upgrade next to 16.3.1

Tipos: feat, fix, docs, chore, test, refactor, perf, ci

## Pull Requests

- Título en formato conventional commit
- Al menos 1 reviewer
- Pasar lint, typecheck y tests antes de pedir review
- Cerrar el issue con "Closes #N" en el cuerpo del PR

## Labels

feature, bug, frontend, backend, ml, critical, spec

## Setup local

pnpm install
pnpm dev        # http://localhost:3000
pnpm test
pnpm typecheck
pnpm lint
pnpm build
