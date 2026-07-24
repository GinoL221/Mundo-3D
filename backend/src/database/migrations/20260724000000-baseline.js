'use strict';

// Baseline migration — squashes the schema state built by years of
// `sequelize.sync({ alter: true })` on boot, plus the one legacy SQL file
// that was authored but never actually applied to the live dev DB
// (`20260701-add-product-stock.sql`, subsumed into `Product.stock` below).
//
// Table DDL is captured verbatim from a live `mysqldump --no-data` of the
// dev database (ground truth, not transcribed from model source) — see
// design.md's "Baseline content source" decision. AUTO_INCREMENT start
// values from the dump are intentionally omitted (that's row-count state,
// not schema shape) so a fresh database starts clean at 1.
//
// The two `20260627-rename-*.sql` files are NOT reproduced here: their
// renames (FROM capitalized columns) already ran against every real
// environment; the columns below are already in their renamed (snake_case)
// form, matching the live DB exactly.
const TABLES_IN_ORDER = [
  {
    name: 'User',
    createSql: `CREATE TABLE \`User\` (
  \`id_user\` int(11) NOT NULL AUTO_INCREMENT,
  \`first_name\` varchar(255) NOT NULL,
  \`last_name\` varchar(255) NOT NULL,
  \`email\` varchar(255) NOT NULL,
  \`image\` varchar(255) DEFAULT NULL,
  \`password_user\` varchar(255) NOT NULL,
  \`id_role\` int(11) NOT NULL DEFAULT 2,
  \`category\` varchar(255) NOT NULL DEFAULT 'User',
  PRIMARY KEY (\`id_user\`),
  UNIQUE KEY \`email\` (\`email\`),
  UNIQUE KEY \`email_2\` (\`email\`),
  UNIQUE KEY \`email_3\` (\`email\`),
  UNIQUE KEY \`email_4\` (\`email\`),
  UNIQUE KEY \`email_5\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'Category',
    createSql: `CREATE TABLE \`Category\` (
  \`id_category\` int(11) NOT NULL AUTO_INCREMENT,
  \`name_category\` varchar(255) NOT NULL,
  PRIMARY KEY (\`id_category\`),
  UNIQUE KEY \`name_category\` (\`name_category\`),
  UNIQUE KEY \`name_category_2\` (\`name_category\`),
  UNIQUE KEY \`name_category_3\` (\`name_category\`),
  UNIQUE KEY \`name_category_4\` (\`name_category\`),
  UNIQUE KEY \`name_category_5\` (\`name_category\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'Franchise',
    createSql: `CREATE TABLE \`Franchise\` (
  \`id_franchise\` int(11) NOT NULL AUTO_INCREMENT,
  \`name_franchise\` varchar(255) NOT NULL,
  PRIMARY KEY (\`id_franchise\`),
  UNIQUE KEY \`name_franchise\` (\`name_franchise\`),
  UNIQUE KEY \`name_franchise_2\` (\`name_franchise\`),
  UNIQUE KEY \`name_franchise_3\` (\`name_franchise\`),
  UNIQUE KEY \`name_franchise_4\` (\`name_franchise\`),
  UNIQUE KEY \`name_franchise_5\` (\`name_franchise\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    // NOTE: `stock` is NOT present in the live dev DB dump — the legacy
    // `20260701-add-product-stock.sql` file was authored but never actually
    // applied there (see apply-progress "Risks" for the required manual
    // dev-DB catch-up step). It IS required by `models/Product.js` and by
    // the application (stock adjustment use case, API), so fresh
    // environments built from this baseline MUST have it.
    name: 'Product',
    createSql: `CREATE TABLE \`Product\` (
  \`id_product\` int(11) NOT NULL AUTO_INCREMENT,
  \`id_category\` int(11) NOT NULL,
  \`id_franchise\` int(11) NOT NULL,
  \`name_product\` varchar(255) NOT NULL,
  \`price\` decimal(10,2) NOT NULL,
  \`description_product\` text DEFAULT NULL,
  \`image\` varchar(255) DEFAULT NULL,
  \`material\` varchar(255) DEFAULT NULL,
  \`height\` decimal(6,2) DEFAULT NULL,
  \`width\` decimal(6,2) DEFAULT NULL,
  \`depth\` decimal(6,2) DEFAULT NULL,
  \`finish\` varchar(255) DEFAULT NULL,
  \`production_time\` int(11) DEFAULT NULL,
  \`stock\` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id_product\`),
  KEY \`product_id_category\` (\`id_category\`),
  KEY \`id_franchise\` (\`id_franchise\`),
  CONSTRAINT \`10\` FOREIGN KEY (\`id_franchise\`) REFERENCES \`Franchise\` (\`id_franchise\`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT \`9\` FOREIGN KEY (\`id_category\`) REFERENCES \`Category\` (\`id_category\`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'ShoppingCart',
    createSql: `CREATE TABLE \`ShoppingCart\` (
  \`id_cart\` int(11) NOT NULL AUTO_INCREMENT,
  \`id_user\` int(11) NOT NULL,
  \`id_product\` int(11) NOT NULL,
  \`quantity\` int(11) NOT NULL,
  \`unit_price\` decimal(10,2) NOT NULL,
  \`cart_status\` varchar(50) NOT NULL,
  PRIMARY KEY (\`id_cart\`),
  KEY \`id_user\` (\`id_user\`),
  KEY \`id_product\` (\`id_product\`),
  CONSTRAINT \`10\` FOREIGN KEY (\`id_product\`) REFERENCES \`Product\` (\`id_product\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`9\` FOREIGN KEY (\`id_user\`) REFERENCES \`User\` (\`id_user\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'RememberToken',
    createSql: `CREATE TABLE \`RememberToken\` (
  \`id_remember_token\` int(11) NOT NULL AUTO_INCREMENT,
  \`id_user\` int(11) NOT NULL,
  \`token_hash\` varchar(64) NOT NULL,
  \`expiry_date\` datetime NOT NULL,
  \`created_at\` datetime NOT NULL,
  PRIMARY KEY (\`id_remember_token\`),
  UNIQUE KEY \`token_hash\` (\`token_hash\`),
  UNIQUE KEY \`token_hash_2\` (\`token_hash\`),
  UNIQUE KEY \`token_hash_3\` (\`token_hash\`),
  UNIQUE KEY \`token_hash_4\` (\`token_hash\`),
  UNIQUE KEY \`token_hash_5\` (\`token_hash\`),
  KEY \`id_user\` (\`id_user\`),
  CONSTRAINT \`1\` FOREIGN KEY (\`id_user\`) REFERENCES \`User\` (\`id_user\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
];

module.exports = {
  async up({ context: queryInterface }) {
    for (const { createSql } of TABLES_IN_ORDER) {
      await queryInterface.sequelize.query(createSql);
    }
  },
  async down({ context: queryInterface }) {
    for (const { name } of [...TABLES_IN_ORDER].reverse()) {
      await queryInterface.dropTable(name);
    }
  },
};
