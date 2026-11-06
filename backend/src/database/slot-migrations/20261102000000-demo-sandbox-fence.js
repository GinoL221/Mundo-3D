'use strict';

// Slot-only source; the control-plane migrator must not discover it. Deliberately
// omit IF NOT EXISTS so MySQL can reject an existing table. MySQL DDL
// implicitly commits; neither rollback nor automatic recovery is implied.
const CREATE_FENCE = `CREATE TABLE \`DemoSandboxFence\` (
  \`slot_id\` VARCHAR(64) NOT NULL PRIMARY KEY,
  \`lease_id\` CHAR(36) BINARY NULL,
  \`generation\` INTEGER UNSIGNED NOT NULL,
  \`state\` ENUM('open', 'fenced') NOT NULL,
  \`reset_attempt_id\` CHAR(36) BINARY NULL
) ENGINE=InnoDB`;

module.exports = {
  async up({ context }) {
    await context.sequelize.query(CREATE_FENCE);
  },

  async down() {
    throw new Error('Fence rollback requires an explicit safe plan');
  },
};
