# Demo Sandbox Cut 1

Backend sandbox engine behind `DEMO_SANDBOX_ENABLED=false` (no HTTP routes exposed yet).
Delivered as 4 sequential PRs to `main` (<=400 authored lines each) under active RDD.

## Specs

- S1 (L1): "Soporte TLS (`DB_CA_CERT`, `rejectUnauthorized: true`) y cargador de configuración fail-closed por env vars en `DemoSandboxConnections.ts` + validación en `env-preflight` (solo cuando `DEMO_SANDBOX_ENABLED=true`, exigiendo `DEMO_SANDBOX_JWT_SECRET` separado de `JWT_SECRET` y 3–5 slots acotados)."
- S2 (L2): Slot env var format `DEMO_SANDBOX_SLOTS_JSON` (JSON array of 3–5 `{ slotId, database, username, password }`), inheriting `DB_HOST`/`DB_PORT`/`DB_CA_CERT`/`DB_NAME` with optional `DEMO_SANDBOX_DB_*` overrides.
- S3 (L1): "Adaptador concreto `SequelizeDemoSandboxResetAdapter` (reset transaccional + seed determinístico de los 17 productos y cuentas ficticias internas del slot: solo `USER` y `STAFF`, nunca `ADMIN` + verificación de estado limpio antes del `reset-receipt` + correo saliente no-op en contexto sandbox)."
- S4 (L1): "Scheduler de expiración/reset + recuperación al arranque en `backend/index.js` (solo activo cuando `DEMO_SANDBOX_ENABLED=true`)."
- S5 (L2): Boot recovery resets `draining` slots automatically; interrupted `resetting` slots stay untouched (warning logged) unless `DEMO_SANDBOX_RECOVER_ON_BOOT=true`.
- S6 (L1): "Pruebas unitarias y de integración en MySQL desechable (pidiendo autorización explícita de contenedor/esquemas antes de levantar MySQL)."

## Tasks

- T1A-1 S1,S2 — PR 1A-1 (Refs #275): TLS + `closeAll()` + fail-closed env loader in `DemoSandboxConnections.ts`, `.env.example`, unit tests — inline — commit: pending
- T1A-2 S1,S2 — PR 1A-2 (Closes #275): conditional `env-preflight.js` validation + tests — inline — commit: pending
- T1B S3 — PR 1B: `NoopMailAdapter`, `SequelizeSandboxResetFence`, deterministic seed (`17` products + `USER`/`STAFF` only), `SequelizeDemoSandboxResetAdapter`, unit tests — inline — commit: pending
- T1C S4,S5 — PR 1C: `listSlotsByStatus` in slot repo, `demoSandboxScheduler.ts`, flag-gated wiring + graceful shutdown in `backend/index.js`, unit tests — inline — commit: pending
- T1D S6 — PR 1D: real disposable MySQL integration test for reset/verify/receipt/isolation (`DemoSandboxResetAdapter.mysql.ts` + `jest.sandbox.config.js`) — inline — commit: pending

## Log

- L1: Retomamos Mundo-3D (/home/ginopc/Desarrollo/Mundo-3D, branch main en acce419, 0 cambios tracked, 0 issues y 0 PRs abiertos). Objetivo de esta sesión — Demo Sandbox Corte 1 (detrás de DEMO_SANDBOX_ENABLED=false, sin exponer rutas HTTP todavía): TLS (`DB_CA_CERT`, `rejectUnauthorized: true`) y cargador fail-closed en `DemoSandboxConnections.ts` + validación en `env-preflight` (`DEMO_SANDBOX_JWT_SECRET` separado de `JWT_SECRET`, 3–5 slots); `SequelizeDemoSandboxResetAdapter` (reset transaccional + seed determinístico de los 17 productos y cuentas `USER`/`STAFF`, nunca `ADMIN` + verificación antes de `reset-receipt` + correo no-op); scheduler de expiración/reset + recuperación al arranque en `backend/index.js`; pruebas unitarias e integración en MySQL desechable con autorización explícita.
- L2: User confirmed 4-PR breakdown (`1A -> 1B -> 1C -> 1D`), `DEMO_SANDBOX_SLOTS_JSON` + `DB_*` inheritance with optional `DEMO_SANDBOX_DB_*` overrides, and `DEMO_SANDBOX_RECOVER_ON_BOOT=false` fail-closed default for interrupted `resetting` slots; authorized creating issue #275 and branch `feat/demo-sandbox-tls-env-preflight`.
