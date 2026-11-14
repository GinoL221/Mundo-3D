# Mundo 3D

Mundo 3D es un proyecto de portfolio con forma de e-commerce de productos impresos en 3D: piezas de catálogo y solicitudes de encargos personalizados. Su objetivo es que un reclutador pueda evaluar el producto y su ingeniería mediante una demo web pública e interactiva, sin instalar herramientas ni configurar el entorno.

El repositorio contiene una API REST de catálogo, autenticación, administración, carrito, pedidos y solicitudes de encargos, junto con un frontend Astro. Es un monorepo `pnpm` con persistencia MySQL y una arquitectura hexagonal pragmática en el backend. La dirección visual es un taller-vitrina: catálogo primero, superficies de papel y tinta e IBM Plex Sans; las superficies retro restantes son deuda, no la identidad objetivo.

La intención, el público y los criterios de aceptación están en [`PRODUCT.md`](PRODUCT.md). Su traducción a experiencia y reglas visuales está en [`DESIGN.md`](DESIGN.md), subordinada al [manual de identidad](docs/diseno/manual-identidad.md).

## Explorar la demo — objetivo

La experiencia prevista permite navegar el catálogo sin registro, probar una compra simulada como comprador y explorar acciones STAFF con datos ficticios y aislados. No incluye cobros reales ni acceso público a ADMIN. Un recorrido breve será opcional; la tienda debe poder explorarse directamente.

**Estado:** este README no publica una URL de demo verificada. El código de la tienda y sus roles no prueba que existan acceso demo sin registro, aislamiento entre visitantes o restauración del estado. Esas capacidades y la disponibilidad pública requieren implementación y verificación separadas; el objetivo no se presenta como desplegado.

### Revisar la ingeniería

- [Arquitectura del backend y frontend](#arquitectura).
- [Estrategia de pruebas](#estrategia-de-pruebas) e [integración continua](#integración-continua).
- [Especificaciones de capacidades](openspec/specs/) y [registros históricos de cambios](openspec/changes/archive/); un registro no sustituye la evidencia de ejecución actual.
- [Límites actuales](#limitaciones-actuales) y [procedimientos de operación](docs/RUNBOOKS.md).

## Inicio rápido local

Esta sección es para ejecutar y desarrollar el proyecto, no un requisito del recorrido previsto para reclutadores.

### Requisitos

- Node.js `>=22.12.0` (el frontend establece el requisito más estricto del workspace).
- `pnpm 11.0.9`, declarado en `package.json`.
- MySQL 8 compatible y un usuario con permiso para crear bases de datos.

### 1. Instalar dependencias

```bash
corepack enable
pnpm install --frozen-lockfile
```

### 2. Configurar el entorno

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Complete `backend/.env` con credenciales locales y secretos aleatorios. Los valores versionados son placeholders; no deben usarse en producción.

```env
PORT=3031
DB_USER=root
DB_PASS=
DB_NAME=mundo_3d_db
DB_HOST=localhost
COOKIE_SECRET=change-me-to-a-random-secret
COOKIE_DOMAIN=
JWT_SECRET=change-me-to-a-random-secret
```

`COOKIE_DOMAIN` es opcional y queda vacío en desarrollo/CI (frontend y backend son ambos `localhost`, y las cookies ignoran el puerto). En producción se fija al dominio raíz (por ejemplo `mundo3d.com`) para que `m3d_csrf`/`m3d_user` sean legibles desde el subdominio del frontend.

El frontend apunta a la API mediante:

```env
PUBLIC_API_URL=http://localhost:3031
```

### 3. Crear y migrar la base

Si no tenés MySQL instalado, podés levantar una instancia local con Docker (mismo `mysql:8.0` que usa CI):

```bash
docker compose up -d
```

La aplicación crea la base configurada si no existe, pero no inicia mientras haya migraciones pendientes. Para un entorno nuevo, créela y aplique las migraciones antes del primer arranque:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS mundo_3d_db;"
pnpm --filter backend db:migrate
pnpm --filter backend db:migrate:status
```

Si cambia `DB_NAME`, use el mismo nombre en el comando SQL. Al iniciar, el backend autentica la conexión, verifica que no haya migraciones pendientes y carga datos iniciales de forma idempotente.

> **Base preexistente:** `db:migrate:adopt-baseline` solo registra la migración baseline sin ejecutar DDL. Úselo únicamente para una base heredada cuyo esquema ya coincide con esa baseline; no lo use para una base vacía.

### 4. Iniciar el proyecto

Ejecute cada servidor en una terminal distinta:

```bash
pnpm dev
```

```bash
pnpm frontend:dev
```

- API: `http://localhost:3031`
- Frontend: `http://localhost:4321`

## Comandos

Todos los comandos de esta tabla se ejecutan desde la raíz.

| Objetivo                             | Comando                                                                        | Alcance y condiciones                                                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend en desarrollo                | `pnpm dev`                                                                     | Express con Node.js `--watch` (Node >=22); requiere MySQL, entorno backend y migraciones al día.                                                                                                                               |
| Frontend en desarrollo               | `pnpm frontend:dev`                                                            | Astro en el puerto `4321`.                                                                                                                                                                                                     |
| Lint                                 | `pnpm lint`                                                                    | Ejecuta `pnpm -r lint`: ESLint `--max-warnings 0` sobre `backend/src/` y `frontend/` (`.ts`, `.astro`, `tools/**/*.js` y archivos de configuración `*.config.{js,mjs}`), aplicando `@typescript-eslint/no-deprecated: "error"` en archivos `**/*.ts`. |
| Verificación de arquitectura         | `pnpm --filter backend architecture:check`                                     | Verifica los límites hexagonales del backend (`backend/tools/architecture/check.js`).                                                                                                                                          |
| Contrato OpenAPI (verificación)      | `pnpm check:openapi`                                                           | Verifica que el artefacto versionado [`backend/openapi.json`](backend/openapi.json) coincida con los JSDoc `@openapi` de las rutas.                                                                                            |
| Contrato OpenAPI (regeneración)      | `pnpm --filter backend generate:openapi`                                       | Regenera [`backend/openapi.json`](backend/openapi.json) a partir de la especificación de rutas y esquemas.                                                                                                                     |
| Type-check                           | `pnpm type-check`                                                              | TypeScript estricto del backend. CI lo ejecuta como paso obligatorio del job `quality`.                                                                                                                                        |
| Pruebas por defecto                  | `pnpm test`                                                                    | Jest backend y Vitest frontend; excluye E2E e integración real, independiente de MySQL.                                                                                                                                        |
| Pruebas rápidas (contrato CI)        | `pnpm test:fast`                                                               | Equivalente explícito al job `quality`: Jest backend (`test:fast`) + Vitest frontend, sin MySQL.                                                                                                                               |
| Scripts de deploy y CI               | `pnpm test:deploy-scripts`                                                     | Ejecuta los tests unitarios (`node --test`) de `scripts/deploy/`, `backend/scripts/` y `.github/scripts/`.                                                                                                                     |
| Jest backend                         | `pnpm --filter backend test` (alias: `pnpm --filter backend test:fast`)        | Excluye `*.integration.test.(ts\|js)`; independiente de MySQL.                                                                                                                                                                 |
| Vitest frontend                      | `pnpm --filter frontend test` (alias: `pnpm frontend:test`)                    | Servicios, adaptadores y scripts del frontend.                                                                                                                                                                                 |
| Cobertura backend + mapa de riesgo   | `pnpm test:coverage`                                                           | Jest con cobertura JS+TS (`backend/src/**/*.{js,ts}`) y mínimos globales de cobertura: 80% ramas, 85% funciones y 90% líneas/sentencias; genera `backend/coverage/{lcov.info,coverage-summary.json,risk-map.json}` clasificando gaps Tier 0 (seguridad, migraciones, carrito, stock). |
| Astro check                          | `pnpm frontend:check`                                                          | `astro check` (diagnóstico TypeScript/Astro real); falla con código distinto de cero ante errores.                                                                                                                             |
| Integración MySQL                    | `pnpm --filter backend test:integration` (alias raíz: `pnpm test:integration`) | Requiere MySQL local; usa bases de prueba desechables, incluida `mundo_3d_migrate_scratch`.                                                                                                                                    |
| Sandbox MySQL                        | `pnpm --filter backend test:sandbox:mysql`                                     | Ejecuta la suite de aislamiento/liberación de sandbox contra MySQL (`jest.sandbox.config.js`).                                                                                                                                  |
| Preparar base E2E                    | `pnpm --filter backend db:test:prepare`                                        | **Recrea `mundo_3d_test` solo con contexto E2E y UUID verificado en cada conexión.** Sin contexto falla con salida 1; ver [estado y límites](docs/e2e-isolation-architecture.md).                                                                                                                                                    |
| E2E Chromium                         | `pnpm test:e2e`                                                                | Requiere Docker: el supervisor crea MySQL/Mailpit por corrida y asigna puertos dinámicos para servicios y aplicaciones. [Contrato, estado de validación y límites](docs/e2e-isolation-architecture.md).                                                                                                                                                   |
| Todos los proyectos E2E configurados | `pnpm test:e2e:all`                                                            | Actualmente solo declara Chromium; también usa el supervisor. UI/debug: `pnpm --filter e2e test:ui` y `test:debug`.                                                                                                                                                                            |
| Estado de migraciones                | `pnpm --filter backend db:migrate:status`                                      | Requiere conexión a la base configurada.                                                                                                                                                                                       |
| Aplicar migraciones                  | `pnpm --filter backend db:migrate`                                             | Ejecuta las migraciones Umzug pendientes.                                                                                                                                                                                      |
| Revertir última migración            | `pnpm --filter backend db:migrate:down`                                        | Operación destructiva; revise la migración antes de usarla.                                                                                                                                                                    |
| Adoptar baseline heredada            | `pnpm --filter backend db:migrate:adopt-baseline`                              | Solo para un esquema preexistente compatible; no ejecuta DDL.                                                                                                                                                                  |
| Build frontend                       | `pnpm frontend:build`                                                          | Genera la salida Astro. Falla si falta `PUBLIC_API_URL` (evita un build de producción que caiga en `localhost` en silencio).                                                                                                   |
| Build backend                        | `pnpm --filter backend build`                                                  | Compila `src/` a `dist/` con `tsc` (excluye tests). En desarrollo el backend sigue corriendo sin compilar, vía `ts-node/register`.                                                                                             |
| Quality check frontend               | `pnpm frontend:quality-check`                                                  | Complementario a ESLint (`pnpm lint`): ejecuta `frontend/tools/quality-check.js` para prohibir `console.log` en las fuentes de producción bajo `frontend/src/` (`.astro`, `.ts`, `.tsx`; omite `.test.ts`, `.css` y `src/styles/normalize.css`). |
| Formatear                            | `pnpm format`                                                                  | Modifica fuentes backend y frontend con Prettier.                                                                                                                                                                              |

Antes del primer E2E local, instale Chromium y sus dependencias:

```bash
pnpm --filter e2e exec playwright install --with-deps chromium
```

## Arquitectura

### Backend

El backend combina un bootstrap CommonJS con módulos JavaScript y TypeScript. En desarrollo se cargan mediante `ts-node/register`; en producción, `pnpm --filter backend build` compila a `dist/` y `RUN_COMPILED=true` (junto a `NODE_ENV=production`) hace que `index.js` sirva ese build compilado sin depender de `ts-node` en runtime. `RUN_COMPILED` es deliberadamente independiente de `NODE_ENV`: los tests de arranque usan `NODE_ENV=production` como escenario contra el árbol sin compilar. El flujo principal mantiene las dependencias orientadas hacia el dominio:

```text
HTTP /api
  -> routes + middlewares
  -> controllers
  -> application use cases
  -> domain entities and ports
  -> Sequelize repository adapters
  -> MySQL
```

- `domain/` contiene entidades, excepciones y contratos de repositorio o seguridad.
- `application/` contiene DTOs y casos de uso para usuarios, productos, categorías, franquicias, carrito, pedidos y solicitudes de encargos.
- `infrastructure/` adapta Express, Sequelize, JWT/bcrypt, logging, validación y uploads.
- `database/` contiene modelos Sequelize, seed, configuración y migraciones Umzug.

El arranque ya no usa `sequelize.sync({ alter: true })` para evolucionar el esquema. Umzug controla las migraciones y el proceso falla antes de escuchar conexiones si detecta alguna pendiente.

### Frontend

Astro organiza las rutas en `frontend/src/pages/` y el comportamiento por dominio en `frontend/src/domains/`:

- `auth/`: login, registro, sesión y adaptadores de API.
- `cart/`: estado Nanostores, persistencia local, sincronización y componentes.
- `products/`: catálogo, detalle y administración de productos.
- `orders/`: detalle e historial de pedidos.
- `commissions/`: servicios para solicitudes de encargos y consulta STAFF/ADMIN.
- `components/`, `layouts/` y `styles/`: interfaz compartida y sistema visual; [`DESIGN.md`](DESIGN.md) distingue las reglas vigentes de la deuda PICO/CRT.

El frontend consume `PUBLIC_API_URL`; en desarrollo usa `http://localhost:3031` como fallback. En un build de producción (`astro build`) es obligatoria: si falta, el build falla en vez de arriesgarse a servir esa URL de fallback en producción.

## Capacidades actuales

Estas capacidades describen la implementación del repositorio; no certifican un despliegue público ni que una base concreta esté preparada.

- Catálogo y detalle de productos, categorías y franquicias.
- Registro y login con sesión JWT en una cookie `httpOnly` (`m3d_auth`), protección CSRF de doble envío firmado (`m3d_csrf`) en cada escritura autenticada, y roles para operaciones administrativas.
- Administración de productos con stock e imágenes, categorías, franquicias y usuarios.
- Carrito local con Nanostores y sincronización por API para usuarios autenticados.
- Creación de pedidos desde el carrito e historial por usuario. El checkout descuenta stock y registra el pedido; el gateway manual genera una referencia sin cobrar dinero ni contactar un procesador externo.
- Solicitud pública de encargos y consulta de solicitudes guardadas por STAFF/ADMIN, con retención de 30 días. Es recepción y revisión, no cotización, seguimiento de un encargo, pago ni correo automático. Requiere las migraciones aplicadas a la base de destino.
- Roles ADMIN, USER y STAFF; STAFF puede crear y actualizar productos, pero no eliminarlos. No son, por sí solos, un mecanismo de acceso demo aislado.
- Páginas informativas, tema claro/oscuro y layouts responsive. La identidad vigente está en el manual y `DESIGN.md`; las superficies PICO/CRT restantes se registran como deuda.
- Seguridad HTTP con Helmet (política CSP explícita, no los defaults genéricos), CORS, rate limiting, validación y logging estructurado con identificadores de request.
- Contrato OpenAPI 3.0 versionado en [`backend/openapi.json`](backend/openapi.json), servido en `GET /api/openapi.json` (solo lectura, sin autenticación ni UI `/docs`) y verificado con `pnpm check:openapi`.
- Endpoints de liveness/readiness (`GET /health/live`, `GET /health/ready`, con `Cache-Control: no-store`) para orquestadores externos.

## Estrategia de pruebas

| Capa                  | Herramienta              | Qué cubre                                                                                              |
| --------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Backend rápida        | Jest, ts-jest, Supertest | Dominio, casos de uso, controladores, rutas, middlewares y adaptadores con dobles o aislamiento local. |
| Backend con base real | Jest + MySQL             | Repositorios, concurrencia y ciclo de migraciones contra bases desechables.                            |
| Frontend              | Vitest                   | Servicios de auth, carrito y productos, adaptadores y scripts del navegador.                           |
| Flujo completo        | Playwright               | Navegación y escenarios integrados con servidores y MySQL reales.                                      |

El patrón de exclusión de Jest (`*.integration.test.(ts|js)`) separa la suite rápida de la integración real, así que `pnpm test`/`pnpm test:fast` no dependen de MySQL. El script `test:integration` selecciona explícitamente los archivos de integración JavaScript y TypeScript.

`pnpm test:coverage` mide producción JS+TS bajo `backend/src/` (excluye tests, tipos, migraciones declarativas y scripts CLI de base de datos que requieren infraestructura viva) y aplica los mínimos globales configurados en [`backend/jest.config.js`](backend/jest.config.js): 80% en ramas (`branches`), 85% en funciones (`functions`) y 90% en líneas y sentencias (`lines`/`statements`). Estos umbrales son condiciones del gate, no una medición de la cobertura actual. `backend/scripts/generate-coverage-risk-map.js` clasifica cada archivo por riesgo — Tier 0 cubre seguridad, migraciones, carrito y stock — y reporta honestamente los gaps preexistentes en `backend/coverage/risk-map.json`; un gap Tier 0 visible no se declara resuelto, se prioriza como seguimiento.

## Configuración

Nunca versionar `backend/.env` ni `frontend/.env`. Las normas de contribución y secretos están en [AGENTS.md](AGENTS.md), y los procedimientos operativos en [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md) y [`docs/demo-sandbox-connections.md`](docs/demo-sandbox-connections.md).

### Variables base (desarrollo local y frontend)

| Variable         | Consumidor | Uso actual                                                                                                                                                       |
| ---------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`           | Backend    | Puerto HTTP; el ejemplo usa `3031`.                                                                                                                              |
| `DB_USER`        | Backend    | Usuario MySQL.                                                                                                                                                   |
| `DB_PASS`        | Backend    | Contraseña MySQL.                                                                                                                                                |
| `DB_NAME`        | Backend    | Base de desarrollo y producción; el ejemplo usa `mundo_3d_db`.                                                                                                   |
| `DB_HOST`        | Backend    | Host MySQL; el ejemplo usa `localhost`.                                                                                                                          |
| `COOKIE_SECRET`  | Backend    | Firma HMAC del token CSRF de doble envío firmado (`m3d_csrf`); obligatoria fuera de tests.                                                                       |
| `COOKIE_DOMAIN`  | Backend    | Opcional (`WARN_ONLY` en preflight); atributo `Domain` de las cookies de sesión (`m3d_auth`/`m3d_csrf`/`m3d_user`). Vacío en desarrollo/CI; dominio raíz en producción. |
| `JWT_SECRET`     | Backend    | Firma y verificación de JWT; obligatoria fuera de tests.                                                                                                         |
| `PUBLIC_API_URL` | Frontend   | URL pública de la API en tiempo de build (`WARN_ONLY` en preflight del backend); obligatoria en `astro build`.                                                   |

### Variables obligatorias de producción (`scripts/deploy/env-preflight.js`)

El preflight de despliegue exige `NODE_ENV=production` y, además de las variables base de base de datos y secretos (`JWT_SECRET`, `COOKIE_SECRET`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`), requiere:

| Variable               | Uso en producción                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `CORS_ORIGIN`          | Origen permitido para CORS (obligatorio cuando `NODE_ENV=production`).                             |
| `DB_PORT`              | Puerto de la base MySQL gestionada.                                                                |
| `DB_CA_CERT`           | Certificado CA para verificar TLS (`rejectUnauthorized: true`) en la conexión MySQL de producción. |
| `R2_ENDPOINT`          | Endpoint S3 explícito del bucket Cloudflare R2 (u otro proveedor S3 compatible).                   |
| `R2_ACCESS_KEY_ID`     | Clave de acceso S3 para uploads de imágenes.                                                       |
| `R2_SECRET_ACCESS_KEY` | Clave secreta S3 para uploads de imágenes.                                                         |
| `R2_BUCKET_NAME`       | Nombre del bucket de almacenamiento de imágenes.                                                   |
| `R2_PUBLIC_URL_BASE`   | URL pública base desde la que se sirven las imágenes subidas.                                      |

### Confirmación de correo (`emailConfirmationConfig.ts` y `backend/src/infrastructure/routes/api/users.ts`)

En entornos no productivos sin ninguna de estas variables definidas, `backend/src/infrastructure/routes/api/users.ts` compone valores locales seguros (`http://localhost:4321`, `localhost:1025`, `SMTP_SECURE=false`, `noreply@example.test`) antes de pasarlos a `emailConfirmationConfig.ts`. Si se define al menos una o si `NODE_ENV=production`, `emailConfirmationConfig.ts` aplica validación estricta:

| Variable         | Uso                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------ |
| `PUBLIC_APP_URL` | Origen público HTTPS (o `http://localhost` en demo local) para enlaces `/confirm-email`. |
| `SMTP_HOST`      | Host del servidor SMTP.                                                              |
| `SMTP_PORT`      | Puerto SMTP (entero entre `1` y `65535`).                                            |
| `SMTP_SECURE`    | `'true'` o `'false'` (TLS implícito vs STARTTLS/plano).                              |
| `SMTP_FROM`      | Dirección remitente (`From`) de los correos de confirmación.                         |
| `SMTP_USER`      | Usuario SMTP opcional (autenticación).                                               |
| `SMTP_PASS`      | Contraseña SMTP opcional (autenticación).                                            |

### Variables opcionales de runtime y rate limiting (`backend/src/` y `backend/index.js`)

| Variable                           | Default                                         | Uso                                                                                 |
| ---------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `LOG_LEVEL`                        | `'silent'` en `test`, `'info'` en otros         | Nivel de log de Pino.                                                               |
| `SHUTDOWN_TIMEOUT_MS`              | `10000` (10 s)                                  | Plazo máximo (ms) de cierre ordenado ante `SIGTERM`/`SIGINT`.                       |
| `RUN_COMPILED`                     | unset (`'true'` para ejecutar `dist/`)          | Carga el build compilado sin `ts-node/register`.                                    |
| `UPLOAD_DIR`                       | `<cwd>/public/img`                              | Directorio local de uploads cuando no se usa R2 (entornos no productivos).          |
| `ACCESS_TOKEN_TTL_SECONDS`         | `1800` (30 min)                                 | Tiempo de vida del JWT de acceso (`m3d_auth`).                                      |
| `REFRESH_TOKEN_REAP_SECONDS`       | `86400` (24 h)                                  | Ventana de retención antes de purgar refresh tokens expirados/revocados.            |
| `LOGIN_LIMIT_WINDOW` / `LOGIN_LIMIT_MAX` | `900000` ms (15 min) / `10`               | Límite de `POST /api/users/login` por IP.                                           |
| `ACCOUNT_LOGIN_LIMIT_WINDOW` / `ACCOUNT_LOGIN_LIMIT_MAX` | `900000` ms (15 min) / `5` | Límite de `POST /api/users/login` por cuenta normalizada.                           |
| `REGISTER_LIMIT_WINDOW` / `REGISTER_LIMIT_MAX` | `900000` ms (15 min) / `3`          | Límite de `POST /api/users/register` por IP.                                        |
| `REFRESH_LIMIT_WINDOW` / `REFRESH_LIMIT_MAX` | `900000` ms (15 min) / `10`           | Límite de `POST /api/users/refresh` por IP.                                         |
| `REVOKE_REFRESH_LIMIT_WINDOW` / `REVOKE_REFRESH_LIMIT_MAX` | `900000` ms (15 min) / `100` | Límite de `POST /api/users/refresh/revoke` por IP.                                  |
| `RESEND_CONFIRMATION_IP_LIMIT_MAX` | `5` (ventana fija de 1 h)                       | Límite de `POST /api/users/email-confirmation/resend` por IP.                       |

## Integración continua

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) se ejecuta en pushes y pull requests dirigidos a `main`. Usa Node 22, `pnpm 11.0.9` y MySQL 8, con cuatro jobs obligatorios y política fail-closed (ningún paso usa `continue-on-error`; un check que falla o no puede ejecutarse bloquea la integración, nunca se trata como éxito):

| Job                 | Contenido                                                                                                                                                                                                         | Requiere MySQL |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `quality`           | Instalación, `architecture:check`, lint, `type-check`, build backend sin emisión, `test:fast`, scripts standalone `.test.js`/`.test.cjs`, `test:coverage` (sube `backend/coverage/{lcov.info,coverage-summary.json,risk-map.json}` como artefacto), `frontend:check`, `frontend:build`. | No             |
| `integration`       | Migraciones sobre una base nueva (`mundo_3d_migrate_ci`) y `test:integration` real contra MySQL.                                                                                                                  | Sí             |
| `e2e`               | Instalación/cache de Chromium y `test:e2e` supervisado con recursos por corrida; solo sube diagnósticos Playwright tras un fallo final.                                                                                       | Sí             |
| `verification-gate` | Se ejecuta siempre (`if: always()`) y solo pasa si `quality`, `integration` y `e2e` resultaron en `success`; cualquier fallo o cancelación bloquea.                                                               | —              |

Los tres jobs de verificación corren en paralelo; `verification-gate` es el único check pensado para exigirse en la protección de la rama `main` (decisión pendiente de autorización explícita del mantenedor fuera de este repositorio — ver `openspec/changes/verification-baseline-and-ci-gates/`).

### Dependencias CI y auditoría

Las acciones de GitHub y las dos imágenes MySQL de CI usan referencias inmutables registradas en [`docs/ci-dependency-provenance.md`](docs/ci-dependency-provenance.md). Renovate solo puede proponer actualizaciones para este workflow; no hace auto-merge. Un mantenedor debe aprobar el PR después de comprobar editor, SHA o digest, firma/provenance y plataforma Linux de MySQL.

`pnpm audit` sigue siendo obligatorio y fail-closed. `AUDIT_ADVISORY` significa que hay una vulnerabilidad que corregir; `AUDIT_AVAILABILITY_FAILURE` indica un problema de registry/red; `AUDIT_EXECUTION_FAILURE` cubre una ejecución ambigua. Los tres últimos estados bloquean la integración y nunca deben convertirse en warnings. El rollback revierte el cambio focalizado a los valores inmutables aprobados previos, nunca a tags mutables.

### Playwright: línea base y diagnósticos de CI

CI ejecuta el único proyecto Chromium con un retry nativo y solo cuando `CI` está definido fija el entorno visual Linux: viewport `1280x720`, `es-AR`, UTC, esquema claro, movimiento reducido y escala 1 sin touch/móvil. Las pruebas visuales de Home mantienen sus propios viewports y fixtures deterministas, esperan fuentes e imágenes, y la línea base solo se cambia mediante un PR con explicación, diff de imagen, entorno Linux confirmado y aprobación de un mantenedor. La paridad de píxeles local entre plataformas queda explícitamente fuera de alcance.

Un primer fallo seguido de éxito deja `RECOVERED_PASS` en el resumen del job: es informativo, pero debe investigarse si se repite. Un fallo tras el retry deja `FINAL_E2E_FAILURE`, conserva reporte HTML, resultados, traces, screenshots y video durante 14 días, y mantiene el gate cerrado. Los diagnósticos no se suben en un éxito final ni deben incluir datos sensibles intencionalmente. El acceso a artefactos depende de los permisos de Actions del repositorio, no de YAML; como el repositorio es público, un mantenedor debe confirmar que la política de acceso cumple el requisito operativo antes de considerar satisfecho el acceso exclusivo del equipo.

## Estructura del repositorio

```text
Mundo-3D/
|-- .github/workflows/ci.yml    # CI con MySQL y Playwright
|-- backend/
|   |-- index.js                # Entry point y secuencia de arranque
|   |-- public/                 # Assets y uploads servidos por Express
|   `-- src/
|       |-- application/        # DTOs y casos de uso
|       |-- database/           # Sequelize, Umzug, seed y configuración
|       |-- domain/             # Entidades, puertos y excepciones
|       `-- infrastructure/     # HTTP, repositorios, seguridad y logging
|-- frontend/
|   |-- public/                 # Assets estáticos
|   `-- src/
|       |-- domains/            # auth, cart, commissions, orders y products
|       |-- pages/              # Rutas Astro
|       |-- components/         # UI compartida
|       |-- layouts/            # Layout base
|       `-- styles/             # Sistema visual
|-- e2e/                        # Configuración y escenarios Playwright
|-- openspec/                   # Especificaciones y cambios SDD
|-- package.json                # Scripts del monorepo
`-- pnpm-workspace.yaml         # backend, frontend y e2e
```

Las especificaciones aceptadas están en [`openspec/specs/`](openspec/specs/). Los cambios bajo `openspec/changes/` pueden ser propuestas o trabajo pendiente y no implican que una capacidad esté disponible en `main`.

## Operación

Procedimientos ante incidentes (backend que no arranca, `/health/ready` trabado, CI en rojo, rotación de secretos, rollback de migraciones) en [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md).

## Limitaciones actuales

Estas son restricciones del comportamiento implementado, no una promesa de roadmap:

- El frontend no persiste el JWT ni lee `Authorization: Bearer`; toda petición autenticada depende de la cookie `httpOnly` `m3d_auth` (`credentials: 'include'`) más el token CSRF de `m3d_csrf`. Solo el carrito sigue en `localStorage` (ver limitación de reconciliación más abajo). `SameSite=Lax` asume que producción sirve el frontend y la API desde el mismo dominio registrable (p. ej. `mundo3d.com` y `api.mundo3d.com`); dos dominios no relacionados invalidarían esa decisión.
- Los pedidos no representan cobros reales ni garantizan entrega o logística. El checkout modifica stock compartido; el historial por usuario no garantiza aislamiento de demo entre visitantes.
- No se ha establecido aquí un modo demo con acceso sin registro, sesiones comprador/STAFF aisladas, límites específicos y recuperación del dataset. No se deben publicar credenciales compartidas como sustituto de esas garantías ni exponer ADMIN mediante el futuro acceso demo.
- El flujo de encargos almacena nombre y email; no debe exponerse a STAFF de demo sin proteger los datos de otros visitantes. El objetivo público usa datos ficticios y no envía correos reales, pero esa restricción no demuestra que toda la aplicación ya bloquee envíos de email.
- Los uploads de desarrollo/test usan disco local bajo `backend/public/img/`; en producción el middleware selecciona el adaptador Cloudflare R2. El código del adaptador no demuestra que el bucket, las credenciales o la disponibilidad del servicio estén configurados y verificados.
- El carrito aplica cambios optimistas y sincroniza en segundo plano, pero no dispone de una lectura de reconciliación desde el backend. Un fallo de red sin respuesta puede dejar el estado local y remoto divergentes hasta otra mutación.
- La preparación E2E recrea `mundo_3d_test`; nunca debe apuntarse esa ejecución a una base con datos que deban conservarse.
