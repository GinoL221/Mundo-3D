const { buildMigrator } = require('./migrator');

// Required tables and columns for the six models the application depends
// on. Column names are the live snake_case DB field names (see each
// model's `field:` mapping under `./models/`), not the model's camelCase
// JS property names. Kept in sync with
// `migrations/20260724000000-baseline.js`'s `TABLES_IN_ORDER`.
const REQUIRED_SCHEMA = {
  User: ['id_user', 'first_name', 'last_name', 'email', 'image', 'password_user', 'id_role', 'category'],
  Category: ['id_category', 'name_category'],
  Franchise: ['id_franchise', 'name_franchise'],
  Product: [
    'id_product', 'id_category', 'id_franchise', 'name_product', 'price', 'description_product',
    'image', 'material', 'height', 'width', 'depth', 'finish', 'production_time', 'stock',
  ],
  ShoppingCart: ['id_cart', 'id_user', 'id_product', 'quantity', 'unit_price', 'cart_status'],
  RememberToken: ['id_remember_token', 'id_user', 'token_hash', 'expiry_date', 'created_at'],
};

// `!` marks NOT NULL. These are the compatibility properties exposed by
// Sequelize's `describeTable`; indexes/defaults are intentionally outside this
// boot-time gate.
const REQUIRED_COLUMN_DEFINITIONS = {
  User: {
    id_user: 'INT(11)!', first_name: 'VARCHAR(255)!', last_name: 'VARCHAR(255)!',
    email: 'VARCHAR(255)!', image: 'VARCHAR(255)', password_user: 'VARCHAR(255)!',
    id_role: 'INT(11)!', category: 'VARCHAR(255)!',
  },
  Category: { id_category: 'INT(11)!', name_category: 'VARCHAR(255)!' },
  Franchise: { id_franchise: 'INT(11)!', name_franchise: 'VARCHAR(255)!' },
  Product: {
    id_product: 'INT(11)!', id_category: 'INT(11)!', id_franchise: 'INT(11)!',
    name_product: 'VARCHAR(255)!', price: 'DECIMAL(10,2)!', description_product: 'TEXT',
    image: 'VARCHAR(255)', material: 'VARCHAR(255)', height: 'DECIMAL(6,2)',
    width: 'DECIMAL(6,2)', depth: 'DECIMAL(6,2)', finish: 'VARCHAR(255)',
    production_time: 'INT(11)', stock: 'INT(11)!',
  },
  ShoppingCart: {
    id_cart: 'INT(11)!', id_user: 'INT(11)!', id_product: 'INT(11)!', quantity: 'INT(11)!',
    unit_price: 'DECIMAL(10,2)!', cart_status: 'VARCHAR(50)!',
  },
  RememberToken: {
    id_remember_token: 'INT(11)!', id_user: 'INT(11)!', token_hash: 'VARCHAR(64)!',
    expiry_date: 'DATETIME!', created_at: 'DATETIME!',
  },
};

// Boot-time schema-consistency gate: positively verifies the migration
// state is fully caught up instead of relying on `seedInitialData` to
// incidentally hit a broken/missing table. Protects tables `seedInitialData`
// never queries (e.g. ShoppingCart, RememberToken) from silent schema drift.
//
// Two layers, in order:
//   1. Migration bookkeeping (`migrator.pending()`) — catches a DB that
//      hasn't run a known migration yet.
//   2. Physical schema (`queryInterface.showAllTables()` /
//      `describeTable()`) — catches a DB where bookkeeping reports "caught
//      up" but a required table/column is actually missing (e.g. manually
//      dropped/altered outside the migration runner). `queryInterface` is
//      read from the migrator's own Umzug `context` (the same query
//      interface `migrator.js` wires it with), so no separate DB handle is
//      required here.
async function checkNoPendingMigrations(migrator = buildMigrator()) {
  const pending = await migrator.pending();
  if (pending.length > 0) {
    throw new Error(
      `Database schema is not fully migrated: ${pending.length} pending migration(s) — run \`pnpm db:migrate\` before starting the server.`
    );
  }

  const queryInterface = migrator.options && migrator.options.context;
  await checkPhysicalSchema(queryInterface);
}

// MySQL 8.0.19+ dropped the display-width attribute from DESCRIBE/SHOW
// COLUMNS output for integer types not given an explicit width at CREATE
// TABLE time — a purely cosmetic, deprecated MySQL notation, not a real
// type difference. A real MySQL 8.0.19+ server reports `INT`, never
// `INT(11)`, for every integer column this schema defines, so a literal
// string comparison always failed here — this only strips a numeric
// display-width suffix off INT/BIGINT/SMALLINT/TINYINT/MEDIUMINT, never off
// DECIMAL (where the parenthesized numbers are real precision/scale) or any
// other type.
function typesAreCompatible(actualType, expectedType) {
  if (actualType === expectedType) return true;
  const stripDisplayWidth = (type) => type.replace(/^(TINY|SMALL|MEDIUM|BIG)?INT\(\d+\)$/, '$1INT');
  return stripDisplayWidth(actualType) === stripDisplayWidth(expectedType);
}

async function checkPhysicalSchema(queryInterface) {
  const existingTables = new Set(await queryInterface.showAllTables());

  for (const [table, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
    if (!existingTables.has(table)) {
      throw new Error(
        `Database schema is missing required table "${table}" even though no migrations are pending — the physical schema does not match the tracked migration state. Verify the database manually before starting the server.`
      );
    }

    const columns = await queryInterface.describeTable(table);
    for (const column of requiredColumns) {
      if (!columns[column]) {
        throw new Error(
          `Database schema is missing required column "${column}" on table "${table}" even though no migrations are pending — the physical schema does not match the tracked migration state. Verify the database manually before starting the server.`
        );
      }

      const expected = REQUIRED_COLUMN_DEFINITIONS[table][column];
      const expectedType = expected.replace(/!$/, '');
      const expectedAllowNull = !expected.endsWith('!');
      const actualType = String(columns[column].type).toUpperCase().replace(/\s+/g, '');
      if (!typesAreCompatible(actualType, expectedType) || columns[column].allowNull !== expectedAllowNull) {
        throw new Error(
          `Database schema has incompatible definition for column "${column}" on table "${table}": expected type ${expectedType} with allowNull=${expectedAllowNull}, got type ${actualType} with allowNull=${columns[column].allowNull}. Verify the database manually before starting the server.`
        );
      }
    }
  }
}

module.exports = {
  checkNoPendingMigrations,
  checkPhysicalSchema,
  REQUIRED_SCHEMA,
  REQUIRED_COLUMN_DEFINITIONS,
};
