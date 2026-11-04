'use strict';

// Slot-only source; the control-plane migrator must not discover it. Deliberately
// omit IF NOT EXISTS so MySQL can reject an existing table. MySQL DDL
// implicitly commits; neither rollback nor automatic recovery is implied.
const CREATE_RELEASE_OPERATION = `CREATE TABLE \`DemoSandboxReleaseOperation\` (
  \`release_id\` CHAR(36) BINARY NOT NULL PRIMARY KEY,
  \`slot_id\` VARCHAR(64) NOT NULL,
  \`generation\` INTEGER UNSIGNED NOT NULL,
  \`attempt_id\` CHAR(36) BINARY NOT NULL,
  \`seed_version\` VARCHAR(128) NOT NULL,
  \`lease_id\` CHAR(36) BINARY NOT NULL,
  UNIQUE KEY \`uq_release_attempt\` (\`slot_id\`, \`generation\`, \`attempt_id\`),
  INDEX \`idx_release_slot_generation\` (\`slot_id\`, \`generation\`)
) ENGINE=InnoDB`;

module.exports = {
  async up({ context }) {
    await context.sequelize.query(CREATE_RELEASE_OPERATION);
  },

  async down() {
    throw new Error('Release rollback requires an explicit safe plan');
  },
};
