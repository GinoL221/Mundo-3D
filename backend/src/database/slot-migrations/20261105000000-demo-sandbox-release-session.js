'use strict';

// Slot-only source; the control-plane migrator must not discover it. Deliberately
// omit IF NOT EXISTS so MySQL can reject an existing table. The session record is
// written on a dedicated connection BEFORE the release transaction starts, so it
// survives that transaction's rollback and can prove the release connection's
// identity even when the release did not commit.
const CREATE_RELEASE_SESSION = `CREATE TABLE \`DemoSandboxReleaseSession\` (
  \`attempt_id\` CHAR(36) BINARY NOT NULL PRIMARY KEY,
  \`slot_id\` VARCHAR(64) NOT NULL,
  \`generation\` INTEGER UNSIGNED NOT NULL,
  \`server_uuid\` CHAR(36) BINARY NOT NULL,
  \`connection_id\` BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY \`uq_release_session_attempt\` (\`slot_id\`, \`generation\`, \`attempt_id\`)
) ENGINE=InnoDB`;

module.exports = {
  async up({ context }) {
    await context.sequelize.query(CREATE_RELEASE_SESSION);
  },

  async down() {
    throw new Error('Release session rollback requires an explicit safe plan');
  },
};
