'use strict';

// Refresh-token rotation migration (HIGH-1 PR1) — alters the existing
// `RememberToken` table to support rotate-on-use refresh tokens. See
// design.md's D1 (rotation atomicity), D2 (grace window), D7 (retention)
// and proposal.md's "Mandatory schema migration" section.
//
// `family_id char(36) NOT NULL` needs no backfill or default: the table has
// zero production callers today (see proposal.md's Scope/PR1 note — this
// entire slice stays dead code through PR1), so it is guaranteed empty.
//
// Follows `20260828000000-orders.js`'s conventions: raw SQL executed via
// `queryInterface.sequelize.query(sql, { transaction })`, wrapped in
// `queryInterface.sequelize.transaction()` for idiomatic Umzug-context
// scoping — NOT rollback protection, since MySQL/InnoDB implicitly commits
// per DDL statement (see design.md's "Migration / Rollout" section). The
// attributed try/catch below names exactly which statements already
// committed, so an operator can clean up manually on a mid-loop failure.
const UP_STATEMENTS = [
  {
    name: 'add rotation columns',
    sql: `ALTER TABLE \`RememberToken\`
      ADD COLUMN \`family_id\` char(36) NOT NULL,
      ADD COLUMN \`superseded_at\` datetime NULL,
      ADD COLUMN \`successor_hash\` varchar(64) NULL,
      ADD COLUMN \`revoked_at\` datetime NULL`,
  },
  {
    name: 'index family_id',
    sql: 'ALTER TABLE `RememberToken` ADD INDEX `idx_remember_token_family_id` (`family_id`)',
  },
  {
    name: 'drop duplicate token_hash unique indexes',
    sql: 'ALTER TABLE `RememberToken` DROP INDEX `token_hash_2`, DROP INDEX `token_hash_3`, DROP INDEX `token_hash_4`, DROP INDEX `token_hash_5`',
  },
];

// Reverses UP_STATEMENTS in exact reverse order, restoring the
// `20260724000000-baseline.js` shape byte-for-byte.
const DOWN_STATEMENTS = [
  {
    name: 'recreate duplicate token_hash unique indexes',
    sql: `ALTER TABLE \`RememberToken\`
      ADD UNIQUE KEY \`token_hash_2\` (\`token_hash\`),
      ADD UNIQUE KEY \`token_hash_3\` (\`token_hash\`),
      ADD UNIQUE KEY \`token_hash_4\` (\`token_hash\`),
      ADD UNIQUE KEY \`token_hash_5\` (\`token_hash\`)`,
  },
  {
    name: 'drop family_id index',
    sql: 'ALTER TABLE `RememberToken` DROP INDEX `idx_remember_token_family_id`',
  },
  {
    name: 'drop rotation columns',
    sql: `ALTER TABLE \`RememberToken\`
      DROP COLUMN \`family_id\`,
      DROP COLUMN \`superseded_at\`,
      DROP COLUMN \`successor_hash\`,
      DROP COLUMN \`revoked_at\``,
  },
];

async function runStatements(queryInterface, statements, transaction, direction) {
  const applied = [];
  for (const { name, sql } of statements) {
    try {
      await queryInterface.sequelize.query(sql, { transaction });
    } catch (error) {
      error.message =
        `Refresh-token-rotation migration ${direction} failed while "${name}" ` +
        `(already applied: [${applied.join(', ') || 'none'}]). MySQL DDL ` +
        'auto-commits per statement, so the steps above were NOT rolled back ' +
        `— clean up manually before retrying. Original error: ${error.message}`;
      throw error;
    }
    applied.push(name);
  }
}

module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.sequelize.transaction((transaction) =>
      runStatements(queryInterface, UP_STATEMENTS, transaction, 'up')
    );
  },
  async down({ context: queryInterface }) {
    await queryInterface.sequelize.transaction((transaction) =>
      runStatements(queryInterface, DOWN_STATEMENTS, transaction, 'down')
    );
  },
};
