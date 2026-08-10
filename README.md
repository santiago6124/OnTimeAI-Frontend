# OnTimeAI Frontend

Dashboard operativo de la tesis OnTimeAI para consultar predicciones de demora de vuelos con base en ATL, evolución temporal, explicaciones SHAP, meteorología y métricas del modelo.

## Arquitectura

- Next.js 16 App Router, React 19 y TypeScript.
- El navegador se comunica únicamente con rutas same-origin de Next.js.
- El token de sesión vive en una cookie `HttpOnly`; el BFF `/api/backend/*` agrega la autorización al llamar a FastAPI.
- El backend se configura con `BACKEND_API_URL`. `NEXT_PUBLIC_API_URL` se mantiene sólo como compatibilidad de despliegues anteriores.
- Las posiciones del mapa son estimaciones sobre la ruta great-circle; no son telemetría ADS-B en vivo.

## Desarrollo

Requisitos: Node.js 20+ y pnpm 10.33.0.

```bash
pnpm install --frozen-lockfile
BACKEND_API_URL=http://localhost:8000 pnpm dev
```

La aplicación queda disponible en `http://localhost:3000` y espera FastAPI en `http://localhost:8000` si no se define otra URL.

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Funcionalidad relevante

- Filtros y paginación de vuelos sincronizados con la URL.
- Mapa y tabla alimentados por el mismo snapshot, con refresco cada 60 segundos sin ocultar datos previos.
- Historial seleccionable por ciclo, con probabilidad base/final, ajuste operativo, umbral y SHAP persistido para ese momento.
- Roles `user`, `admin` y `superadmin`; el perfil pasajero es obligatorio para usuarios comunes.

La auditoría técnica y las decisiones de UX están documentadas en [`docs/AUDITORIA_FRONTEND_2026-08-09.md`](docs/AUDITORIA_FRONTEND_2026-08-09.md).
