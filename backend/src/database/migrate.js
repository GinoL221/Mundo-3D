#!/usr/bin/env node
const { buildMigrator } = require('./migrator');

// Marks every currently pending migration as applied WITHOUT running its
// `up()` DDL — for environments (e.g. the existing dev DB) whose schema was
// already built by the legacy `sync({ alter: true })` mechanism and already
// matches the target schema.
async function adoptBaseline(migrator) {
  const pending = await migrator.pending();
  for (const migration of pending) {
    await migrator.storage.logMigration({ name: migration.name });
  }
  return pending.map((migration) => migration.name);
}

async function run(argv = process.argv.slice(2)) {
  const migrator = buildMigrator();

  if (argv[0] === 'adopt-baseline') {
    const adopted = await adoptBaseline(migrator);
    console.log(
      adopted.length > 0
        ? `Adopted baseline: marked ${adopted.join(', ')} as applied (no DDL executed).`
        : 'Nothing to adopt — no pending migrations.'
    );
    return true;
  }

  return migrator.runAsCLI(argv);
}

if (require.main === module) {
  run()
    .then((success) => {
      if (success === false) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { run, adoptBaseline };
