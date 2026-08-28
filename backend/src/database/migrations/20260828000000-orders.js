'use strict';

// Orders & checkout migration — adds `Order` and `OrderItem`, additive only
// (no existing table altered). Follows `20260724000000-baseline.js`'s exact
// shape: a `TABLES_IN_ORDER` array, raw SQL executed via
// `queryInterface.sequelize.query(createSql, { transaction })` in
// FK-dependency order, `down()` dropping in reverse, and the baseline's
// attributed try/catch error message (MySQL DDL auto-commits per statement,
// so a mid-loop failure cannot be rolled back — see design.md's "Migration /
// Rollout" section).
//
// `Order` is a MySQL reserved word — every reference below is
// backtick-quoted, matching the convention every raw-SQL repository query
// against this table must also follow.
//
// `OrderItem.id_product` is nullable with `fk_order_item_product` set to
// `ON DELETE SET NULL` (not `CASCADE`/`RESTRICT`) — see design.md's
// "Architecture Decisions" section. `RESTRICT`/`NO ACTION` would turn the
// existing `DELETE /api/products/:id` into an HTTP 500 for any ever-ordered
// product; `CASCADE` would silently erase order history. `product_name` is a
// NOT NULL snapshot column so the order record still shows what was
// purchased once `id_product` becomes NULL.
const TABLES_IN_ORDER = [
  {
    name: 'Order',
    createSql: `CREATE TABLE \`Order\` (
  \`id_order\` int(11) NOT NULL AUTO_INCREMENT,
  \`id_user\` int(11) NOT NULL,
  \`idempotency_key\` varchar(64) NOT NULL,
  \`order_status\` varchar(50) NOT NULL DEFAULT 'AWAITING_PAYMENT',
  \`payment_reference\` varchar(255) DEFAULT NULL,
  \`created_at\` datetime NOT NULL,
  PRIMARY KEY (\`id_order\`),
  UNIQUE KEY \`uq_order_user_idempotency\` (\`id_user\`,\`idempotency_key\`),
  KEY \`id_user\` (\`id_user\`),
  CONSTRAINT \`fk_order_user\` FOREIGN KEY (\`id_user\`) REFERENCES \`User\` (\`id_user\`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'OrderItem',
    createSql: `CREATE TABLE \`OrderItem\` (
  \`id_order_item\` int(11) NOT NULL AUTO_INCREMENT,
  \`id_order\` int(11) NOT NULL,
  \`id_product\` int(11) DEFAULT NULL,
  \`product_name\` varchar(255) NOT NULL,
  \`quantity\` int(11) NOT NULL,
  \`unit_price\` decimal(10,2) NOT NULL,
  PRIMARY KEY (\`id_order_item\`),
  KEY \`id_order\` (\`id_order\`),
  KEY \`id_product\` (\`id_product\`),
  CONSTRAINT \`fk_order_item_order\` FOREIGN KEY (\`id_order\`) REFERENCES \`Order\` (\`id_order\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`fk_order_item_product\` FOREIGN KEY (\`id_product\`) REFERENCES \`Product\` (\`id_product\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
];

module.exports = {
  async up({ context: queryInterface }) {
    const created = [];
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const { name, createSql } of TABLES_IN_ORDER) {
        try {
          await queryInterface.sequelize.query(createSql, { transaction });
        } catch (error) {
          error.message =
            `Orders migration failed while creating "${name}" ` +
            `(already created: [${created.join(', ') || 'none'}]). MySQL DDL ` +
            'auto-commits per statement, so the tables above were NOT rolled ' +
            `back — drop them manually before retrying. Original error: ${error.message}`;
          throw error;
        }
        created.push(name);
      }
    });
  },
  async down({ context: queryInterface }) {
    const dropped = [];
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const { name } of [...TABLES_IN_ORDER].reverse()) {
        try {
          await queryInterface.dropTable(name, { transaction });
        } catch (error) {
          error.message =
            `Orders rollback failed while dropping "${name}" ` +
            `(already dropped: [${dropped.join(', ') || 'none'}]). MySQL DDL ` +
            'auto-commits per statement, so the tables above were NOT restored ' +
            `— recreate them manually or re-run up() before retrying. Original error: ${error.message}`;
          throw error;
        }
        dropped.push(name);
      }
    });
  },
};
