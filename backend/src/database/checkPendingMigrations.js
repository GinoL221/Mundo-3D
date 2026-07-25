const { buildMigrator } = require('./migrator');

// Boot-time schema-consistency gate: positively verifies the migration
// state is fully caught up instead of relying on `seedInitialData` to
// incidentally hit a broken/missing table. Protects tables `seedInitialData`
// never queries (e.g. ShoppingCart, RememberToken) from silent schema drift.
async function checkNoPendingMigrations(migrator = buildMigrator()) {
  const pending = await migrator.pending();
  if (pending.length > 0) {
    throw new Error(
      `Database schema is not fully migrated: ${pending.length} pending migration(s) — run \`pnpm db:migrate\` before starting the server.`
    );
  }
}

module.exports = { checkNoPendingMigrations };
