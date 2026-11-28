'use strict';

require('dotenv').config();

const db = require('./models/db');
const { syncCatalogData } = require('./seed');

async function main() {
  try {
    await db.sequelize.authenticate();
    const summary = await syncCatalogData(db);
    process.stdout.write(
      `Catalog sync complete: +${summary.categoriesCreated} categories, +${summary.franchisesCreated} franchises, +${summary.productsCreated} products created, ${summary.productsUpdated} products updated.\n`,
    );
  } finally {
    await db.sequelize.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(
      `Catalog sync failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}

module.exports = { main };
