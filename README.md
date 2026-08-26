# Mundo-3D

Mundo-3D es un e-commerce de productos impresos en 3D. El repositorio contiene una API REST de catálogo, autenticación, administración y carrito, junto con un frontend Astro de estética pixel art. Es un monorepo `pnpm` con persistencia MySQL y una arquitectura hexagonal pragmática en el backend.

## Inicio rápido

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

| Objetivo | Comando | Alcance y condiciones |
|---|---|---|
| Backend en desarrollo | `pnpm dev` | Express con Nodemon; requiere MySQL, entorno backend y migraciones al día. |
| Frontend en desarrollo | `pnpm frontend:dev` | Astro en el puerto `4321`. |
| Lint | `pnpm lint` | Ejecuta los scripts disponibles en el workspace; actualmente ESLint sobre `backend/src/`. |
| Type-check | `pnpm type-check` | TypeScript estricto del backend. CI lo ejecuta como paso obligatorio del job `quality`. |
| Pruebas por defecto | `pnpm test` | Jest backend y Vitest frontend; excluye E2E e integración real, independiente de MySQL. |
| Pruebas rápidas (contrato CI) | `pnpm test:fast` | Equivalente explícito al job `quality`: Jest backend (`test:fast`) + Vitest frontend, sin MySQL. |
| Jest backend | `pnpm --filter backend test` (alias: `pnpm --filter backend test:fast`) | Excluye `*.integration.test.(ts\|js)`; independiente de MySQL. |
| Vitest frontend | `pnpm --filter frontend test` (alias: `pnpm frontend:test`) | Servicios, adaptadores y scripts del frontend. |
| Cobertura backend + mapa de riesgo | `pnpm test:coverage` | Jest con cobertura JS+TS (`backend/src/**/*.{js,ts}`) y guardas globales del 50%; genera `backend/coverage/{lcov.info,coverage-summary.json,risk-map.json}` clasificando gaps Tier 0 (seguridad, migraciones, carrito, stock). |
| Astro check | `pnpm frontend:check` | `astro check` (diagnóstico TypeScript/Astro real); falla con código distinto de cero ante errores. |
| Integración MySQL | `pnpm --filter backend test:integration` (alias raíz: `pnpm test:integration`) | Requiere MySQL local; usa bases de prueba desechables, incluida `mundo_3d_migrate_scratch`. |
| Preparar base E2E | `pnpm --filter backend db:test:prepare` | **Recrea con `force: true` la base fija `mundo_3d_test` y carga fixtures.** |
| E2E Chromium | `pnpm test:e2e` | Playwright levanta backend `3032` y frontend `4322`; recrea `mundo_3d_test`. |
| Todos los proyectos E2E configurados | `pnpm test:e2e:all` | Actualmente la configuración solo declara Chromium. |
| Estado de migraciones | `pnpm --filter backend db:migrate:status` | Requiere conexión a la base configurada. |
| Aplicar migraciones | `pnpm --filter backend db:migrate` | Ejecuta las migraciones Umzug pendientes. |
| Revertir última migración | `pnpm --filter backend db:migrate:down` | Operación destructiva; revise la migración antes de usarla. |
| Adoptar baseline heredada | `pnpm --filter backend db:migrate:adopt-baseline` | Solo para un esquema preexistente compatible; no ejecuta DDL. |
| Build frontend | `pnpm frontend:build` | Genera la salida Astro. No hay un script de build del backend: se ejecuta con `ts-node/register`. |
| Formatear | `pnpm format` | Modifica fuentes backend y frontend con Prettier. |

Antes del primer E2E local, instale Chromium y sus dependencias:

```bash
pnpm --filter e2e exec playwright install --with-deps chromium
```

## Arquitectura

### Backend

El backend combina un bootstrap CommonJS con módulos JavaScript y TypeScript cargados mediante `ts-node`. El flujo principal mantiene las dependencias orientadas hacia el dominio:

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
- `application/` contiene DTOs y casos de uso para usuarios, productos, categorías, franquicias y carrito.
- `infrastructure/` adapta Express, Sequelize, JWT/bcrypt, logging, validación y uploads.
- `database/` contiene modelos Sequelize, seed, configuración y migraciones Umzug.

El arranque ya no usa `sequelize.sync({ alter: true })` para evolucionar el esquema. Umzug controla las migraciones y el proceso falla antes de escuchar conexiones si detecta alguna pendiente.

### Frontend

Astro organiza las rutas en `frontend/src/pages/` y el comportamiento por dominio en `frontend/src/domains/`:

- `auth/`: login, registro, sesión y adaptadores de API.
- `cart/`: estado Nanostores, persistencia local, sincronización y componentes.
- `products/`: catálogo, detalle y administración de productos.
- `components/`, `layouts/` y `styles/`: interfaz compartida y sistema visual pixel art.

El frontend consume `PUBLIC_API_URL`; en desarrollo usa `http://localhost:3031` como fallback.

## Capacidades actuales

- Catálogo y detalle de productos, categorías y franquicias.
- Registro y login mediante JWT, con roles para operaciones administrativas.
- Administración de productos con stock e imágenes, categorías, franquicias y usuarios.
- Carrito local con Nanostores y sincronización por API para usuarios autenticados.
- Páginas informativas, tema claro/oscuro y diseño responsive de estética PICO-8.
- Seguridad HTTP con Helmet, CORS, rate limiting, validación y logging estructurado con identificadores de request.

## Estrategia de pruebas

| Capa | Herramienta | Qué cubre |
|---|---|---|
| Backend rápida | Jest, ts-jest, Supertest | Dominio, casos de uso, controladores, rutas, middlewares y adaptadores con dobles o aislamiento local. |
| Backend con base real | Jest + MySQL | Repositorios, concurrencia y ciclo de migraciones contra bases desechables. |
| Frontend | Vitest | Servicios de auth, carrito y productos, adaptadores y scripts del navegador. |
| Flujo completo | Playwright | Navegación y escenarios integrados con servidores y MySQL reales. |

El patrón de exclusión de Jest (`*.integration.test.(ts|js)`) separa la suite rápida de la integración real, así que `pnpm test`/`pnpm test:fast` no dependen de MySQL. El script `test:integration` selecciona explícitamente los archivos de integración JavaScript y TypeScript.

`pnpm test:coverage` mide producción JS+TS bajo `backend/src/` (excluye tests, tipos, migraciones declarativas y scripts CLI de base de datos que requieren infraestructura viva) y mantiene sin cambios las guardas globales del 50% en branches/functions/lines/statements hasta que una base medida y revisada justifique modificarlas. `backend/scripts/generate-coverage-risk-map.js` clasifica cada archivo por riesgo — Tier 0 cubre seguridad, migraciones, carrito y stock — y reporta honestamente los gaps preexistentes en `backend/coverage/risk-map.json`; un gap Tier 0 visible no se declara resuelto, se prioriza como seguimiento.

## Configuración

| Variable | Consumidor | Uso actual |
|---|---|---|
| `PORT` | Backend | Puerto HTTP; el ejemplo usa `3031`. |
| `DB_USER` | Backend | Usuario MySQL. |
| `DB_PASS` | Backend | Contraseña MySQL. |
| `DB_NAME` | Backend | Base de desarrollo y producción; el ejemplo usa `mundo_3d_db`. |
| `DB_HOST` | Backend | Host MySQL; el ejemplo usa `localhost`. |
| `COOKIE_SECRET` | Backend | Firma HMAC del token CSRF de doble envío firmado (`m3d_csrf`); obligatoria fuera de tests. |
| `COOKIE_DOMAIN` | Backend | Opcional; atributo `Domain` de las cookies de sesión (`m3d_auth`/`m3d_csrf`/`m3d_user`). Vacío en desarrollo/CI (mismo `localhost`); dominio raíz en producción. |
| `JWT_SECRET` | Backend | Firma y verificación de JWT; obligatoria fuera de tests. |
| `PUBLIC_API_URL` | Frontend | URL pública de la API; el ejemplo usa `http://localhost:3031`. |

Nunca versionar `backend/.env` ni `frontend/.env`. Las normas de contribución y secretos están en [AGENTS.md](AGENTS.md).

## Integración continua

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) se ejecuta en pushes y pull requests dirigidos a `main`. Usa Node 22, `pnpm 11.0.9` y MySQL 8, con cuatro jobs obligatorios y política fail-closed (ningún paso usa `continue-on-error`; un check que falla o no puede ejecutarse bloquea la integración, nunca se trata como éxito):

| Job | Contenido | Requiere MySQL |
|---|---|---|
| `quality` | Instalación, `architecture:check`, lint, `type-check`, `test:fast`, `test:coverage` (sube `backend/coverage/{lcov.info,coverage-summary.json,risk-map.json}` como artefacto), `frontend:check`, `frontend:build`. | No |
| `integration` | Migraciones sobre una base nueva (`mundo_3d_migrate_ci`) y `test:integration` real contra MySQL. | Sí |
| `e2e` | Instalación/cache de navegadores Playwright y `test:e2e` (Chromium); sube el reporte Playwright como artefacto. | Sí |
| `verification-gate` | Se ejecuta siempre (`if: always()`) y solo pasa si `quality`, `integration` y `e2e` resultaron en `success`; cualquier fallo o cancelación bloquea. | — |

Los tres jobs de verificación corren en paralelo; `verification-gate` es el único check pensado para exigirse en la protección de la rama `main` (decisión pendiente de autorización explícita del mantenedor fuera de este repositorio — ver `openspec/changes/verification-baseline-and-ci-gates/`).

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
|       |-- domains/            # auth, cart y products
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

## Limitaciones actuales

Estas son restricciones del comportamiento implementado, no una promesa de roadmap:

- El JWT, los datos básicos de usuario y el carrito se almacenan en `localStorage`; no existe autenticación del frontend basada exclusivamente en cookies `httpOnly`.
- El checkout actual vacía y sincroniza el carrito. No crea órdenes ni integra pagos o logística.
- Los uploads se escriben en el filesystem local bajo `backend/public/img/`; no hay almacenamiento de objetos externo ni persistencia compartida entre instancias.
- El carrito aplica cambios optimistas y sincroniza en segundo plano, pero no dispone de una lectura de reconciliación desde el backend. Un fallo de red sin respuesta puede dejar el estado local y remoto divergentes hasta otra mutación.
- La preparación E2E recrea `mundo_3d_test`; nunca debe apuntarse esa ejecución a una base con datos que deban conservarse.
