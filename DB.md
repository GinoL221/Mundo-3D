# Esquema de Base de Datos — Mundo 3D

Base de datos principal: `mundo_3d_db` (motor MySQL 8 / InnoDB). Las tablas principales especifican charset `utf8mb4` y collation `utf8mb4_unicode_ci`, mientras que `DemoSandboxSlot` (`20261026000000-demo-sandbox-slots.js`) hereda el motor, charset y collation por defecto de la base de datos. En pruebas E2E se utiliza `mundo_3d_test` y en CI de migraciones `mundo_3d_migrate_ci`.

## Evolución del esquema

La evolución del esquema se gestiona **estrictamente mediante migraciones Umzug** definidas en [`backend/src/database/migrations/`](backend/src/database/migrations/) y ejecutadas con [`backend/src/database/migrate.js`](backend/src/database/migrate.js):

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS mundo_3d_db;"
pnpm --filter backend db:migrate
pnpm --filter backend db:migrate:status
```

El backend **no** utiliza `sequelize.sync({ alter: true })`. Al iniciar, `backend/index.js` verifica que no existan migraciones pendientes y aborta el arranque si falta alguna por aplicar.

### Historial de migraciones

| Archivo | Alcance |
| --- | --- |
| `20260724000000-baseline.js` | Esquema base (`User`, `Category`, `Franchise`, `Product`, `ShoppingCart`, `RememberToken`). |
| `20260828000000-orders.js` | Tablas `Order` y `OrderItem` para checkout e historial de pedidos. |
| `20260901000000-refresh-token-rotation.js` | Columnas de rotación y familia en `RememberToken` (`family_id`, `superseded_at`, `successor_hash`, `revoked_at`). |
| `20260902000000-email-confirmation.js` | Columna `User.email_verified_at` (con backfill de cuentas existentes) y tabla `EmailConfirmationToken`. |
| `20260927000000-custom-commission-requests.js` | Tabla `CustomCommissionRequest` para solicitudes públicas de encargos personalizados. |
| `20261026000000-demo-sandbox-slots.js` | Tabla `DemoSandboxSlot` para gestión de slots de sandbox demo. |

---

## Tablas migradas

### `User`

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_user` | `INT NOT NULL AUTO_INCREMENT` (PK) | |
| `first_name` | `VARCHAR(255) NOT NULL` | |
| `last_name` | `VARCHAR(255) NOT NULL` | |
| `email` | `VARCHAR(255) NOT NULL` (UNIQUE) | |
| `image` | `VARCHAR(255) NULL` | Ruta o URL de imagen de perfil |
| `password_user` | `VARCHAR(255) NOT NULL` | Hash bcrypt |
| `id_role` | `INT NOT NULL DEFAULT 2` | |
| `category` | `VARCHAR(255) NOT NULL DEFAULT 'User'` | Rol almacenado (`'Admin'`, `'Staff'`, `'User'`; corresponde al enum `Role` en `domain/Role.ts`: `ADMIN`, `STAFF`, `USER`) |
| `email_verified_at` | `DATETIME NULL DEFAULT NULL` | Agregada en `20260902000000-email-confirmation.js`; `NULL` hasta confirmar el correo |

### `Category`

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_category` | `INT NOT NULL AUTO_INCREMENT` (PK) | |
| `name_category` | `VARCHAR(255) NOT NULL` (UNIQUE) | Valores iniciales (10, vía script idempotente `backend/src/database/seed.js`, no migraciones): `Llavero`, `Busto`, `Figura`, `Mascara`, `Otras`, `Lámpara`, `Accesorios`, `Terror/Fantasía`, `Utilitarios`, `Juguetes` |

### `Franchise`

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_franchise` | `INT NOT NULL AUTO_INCREMENT` (PK) | |
| `name_franchise` | `VARCHAR(255) NOT NULL` (UNIQUE) | Valores iniciales (10, vía script idempotente `backend/src/database/seed.js`, no migraciones): `Marvel`, `DC`, `Disney`, `Otra`, `Zelda`, `Star Wars`, `Portal`, `Pokemon`, `Nintendo`, `Terror/Fantasía` |

### `Product`

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_product` | `INT NOT NULL AUTO_INCREMENT` (PK) | |
| `id_category` | `INT NOT NULL` (FK -> `Category.id_category`) | `ON DELETE NO ACTION ON UPDATE CASCADE` |
| `id_franchise` | `INT NOT NULL` (FK -> `Franchise.id_franchise`) | `ON DELETE NO ACTION ON UPDATE CASCADE` |
| `name_product` | `VARCHAR(255) NOT NULL` | |
| `price` | `DECIMAL(10,2) NOT NULL` | |
| `description_product` | `TEXT NULL` | |
| `image` | `VARCHAR(255) NULL` | |
| `material` | `VARCHAR(255) NULL` | `'PLA' \| 'Resina' \| 'PETG' \| 'Flex'` o `'Otros: ...'` |
| `height` | `DECIMAL(6,2) NULL` | `>= 0` |
| `width` | `DECIMAL(6,2) NULL` | `>= 0` |
| `depth` | `DECIMAL(6,2) NULL` | `>= 0` |
| `finish` | `VARCHAR(255) NULL` | Texto libre (ej. `'Pintado a mano'`) |
| `production_time` | `INT NULL` | Entero positivo, máximo 30 (días) |
| `stock` | `INT NOT NULL DEFAULT 0` | |

### `ShoppingCart`

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_cart` | `INT NOT NULL AUTO_INCREMENT` (PK) | |
| `id_user` | `INT NOT NULL` (FK -> `User.id_user`) | `ON DELETE CASCADE ON UPDATE CASCADE` |
| `id_product` | `INT NOT NULL` (FK -> `Product.id_product`) | `ON DELETE CASCADE ON UPDATE CASCADE` |
| `quantity` | `INT NOT NULL` | |
| `unit_price` | `DECIMAL(10,2) NOT NULL` | |
| `cart_status` | `VARCHAR(50) NOT NULL` | |

### `RememberToken`

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_remember_token` | `INT NOT NULL AUTO_INCREMENT` (PK) | |
| `id_user` | `INT NOT NULL` (FK -> `User.id_user`) | `ON DELETE CASCADE ON UPDATE CASCADE` |
| `token_hash` | `VARCHAR(64) NOT NULL` (UNIQUE) | Digest SHA-256 |
| `expiry_date` | `DATETIME NOT NULL` | |
| `created_at` | `DATETIME NOT NULL` | |
| `family_id` | `CHAR(36) NOT NULL` (INDEX) | Familia de rotación (`20260901000000`) |
| `superseded_at` | `DATETIME NULL` | Marca temporal de reemplazo |
| `successor_hash` | `VARCHAR(64) NULL` | Hash del token sucesor |
| `revoked_at` | `DATETIME NULL` | Revocación de token/familia |

### `EmailConfirmationToken`

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_email_confirmation_token` | `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT` (PK) | |
| `id_user` | `INT NOT NULL` (FK -> `User.id_user`) | `ON DELETE CASCADE ON UPDATE CASCADE` |
| `token_hash` | `CHAR(64) NOT NULL` (UNIQUE) | Digest SHA-256; nunca se persiste en texto plano |
| `expires_at` | `DATETIME NOT NULL` | |
| `consumed_at` | `DATETIME NULL` | |
| `invalidated_at` | `DATETIME NULL` | |
| `active_slot` | `TINYINT NULL` | Índice único `(id_user, active_slot)` para garantizar un único token activo |
| `created_at` | `DATETIME NOT NULL` | Índice `(id_user, created_at)` |

### `Order` y `OrderItem`

`Order` (nota: palabra reservada en MySQL, siempre entre backticks en SQL crudo):

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_order` | `INT NOT NULL AUTO_INCREMENT` (PK) | |
| `id_user` | `INT NOT NULL` (FK -> `User.id_user`) | `ON DELETE NO ACTION ON UPDATE CASCADE` |
| `idempotency_key` | `VARCHAR(64) NOT NULL` | Índice único `(id_user, idempotency_key)` |
| `order_status` | `VARCHAR(50) NOT NULL DEFAULT 'AWAITING_PAYMENT'` | |
| `payment_reference` | `VARCHAR(255) NULL` | |
| `created_at` | `DATETIME NOT NULL` | |

`OrderItem`:

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_order_item` | `INT NOT NULL AUTO_INCREMENT` (PK) | |
| `id_order` | `INT NOT NULL` (FK -> `Order.id_order`) | `ON DELETE CASCADE ON UPDATE CASCADE` |
| `id_product` | `INT NULL` (FK -> `Product.id_product`) | `ON DELETE SET NULL ON UPDATE CASCADE` para conservar historial si se elimina el producto |
| `product_name` | `VARCHAR(255) NOT NULL` | Snapshot del nombre del producto |
| `quantity` | `INT NOT NULL` | |
| `unit_price` | `DECIMAL(10,2) NOT NULL` | |

### `CustomCommissionRequest`

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `id_custom_commission_request` | `INT NOT NULL AUTO_INCREMENT` (PK) | |
| `name` | `VARCHAR(255) NOT NULL` | |
| `email` | `VARCHAR(320) NOT NULL` | |
| `idea` | `TEXT NOT NULL` | |
| `id_product` | `INT NULL` (FK -> `Product.id_product`) | `ON DELETE SET NULL ON UPDATE CASCADE` |
| `created_at` | `DATETIME NOT NULL` | |
| `expires_at` | `DATETIME NOT NULL` (INDEX) | Retención de 30 días |

### `DemoSandboxSlot`

| Columna | Tipo / Restricción | Notas |
| --- | --- | --- |
| `slot_id` | `VARCHAR(64) NOT NULL` (PK) | |
| `status` | `ENUM('available','leased','draining','resetting','quarantined') NOT NULL` | Índices `(status, slot_id)` y `(status, idle_expires_at)` |
| `generation` | `INT UNSIGNED NOT NULL DEFAULT 0` | |
| `lease_id` | `CHAR(36) NULL` (UNIQUE) | |
| `allocated_at` | `DATETIME(3) NULL` | |
| `last_activity_at` | `DATETIME(3) NULL` | |
| `idle_expires_at` | `DATETIME(3) NULL` | |
| `absolute_expires_at` | `DATETIME(3) NULL` | |
| `last_reset_verified_at` | `DATETIME(3) NULL` | |
| `reset_attempt_id` | `CHAR(36) NULL` (UNIQUE) | |
| `quarantine_reason` | `VARCHAR(255) NULL` | |

---

## Relaciones Sequelize (`backend/src/database/models/registerModels.js`)

- `User` 1:N `ShoppingCart`, `RememberToken`, `EmailConfirmationToken`, `Order`
- `Order` 1:N `OrderItem` (alias `items`)
- `Product` 1:N `ShoppingCart`, `OrderItem`, `CustomCommissionRequest`
- `Product` N:1 `Category` (alias `Category`) y `Franchise` (alias `Franchise`)

## Modelos y migraciones de slots de sandbox (`backend/src/database/slot-migrations/`)

En [`backend/src/database/models/`](backend/src/database/models/) existen además los modelos TypeScript aislados `DemoSandboxFence`, `DemoSandboxResetReceipt`, `DemoSandboxReleaseOperation` y `DemoSandboxReleaseSession`. Estas tablas no se registran en `registerModels.js` ni se migran en la base principal mediante `backend/src/database/migrations/`, sino que se migran en cada base de datos de sandbox por slot a través de [`backend/src/database/slot-migrations/`](backend/src/database/slot-migrations/).
