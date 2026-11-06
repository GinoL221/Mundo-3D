'use strict';

// Slot-only source; the control-plane migrator must not discover it. Deliberately
// omit IF NOT EXISTS so MySQL can reject an existing table. MySQL DDL
// implicitly commits; neither rollback nor automatic recovery is implied.
const CREATE_RECEIPT = `CREATE TABLE \`DemoSandboxResetReceipt\` (
  \`attempt_id\` CHAR(36) BINARY NOT NULL PRIMARY KEY,
  \`slot_id\` VARCHAR(64) NOT NULL,
  \`generation\` INTEGER UNSIGNED NOT NULL,
  \`seed_version\` VARCHAR(128) NOT NULL,
  \`consumed\` TINYINT(1) NOT NULL DEFAULT 0,
  INDEX \`idx_receipt_slot_generation\` (\`slot_id\`, \`generation\`)
) ENGINE=InnoDB`;

module.exports = {
  async up({ context }) {
    await context.sequelize.query(CREATE_RECEIPT);
  },

  async down() {
    throw new Error('Receipt rollback requires an explicit safe plan');
  },
};
