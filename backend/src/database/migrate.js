#!/usr/bin/env node
const { buildMigrator } = require('./migrator');

// The only migration safe to "adopt" (mark applied without running its DDL)
// by default is the baseline itself — the dev DB it targets was already
// built to match this exact schema by the legacy `sync({ alter: true })`
// mechanism. Any migration added AFTER the baseline must actually run its
// DDL for real; silently marking it "applied" without executing it would
// cause schema drift on the exact environment this command exists to
// converge. Pass explicit migration names to `adopt-baseline` to adopt a
// different (deliberate) scope instead of relying on this default.
const BASELINE_MIGRATION_NAME = '20260724000000-baseline.js';

// Marks the given migration name(s) (default: only the baseline) as applied
// WITHOUT running their `up()` DDL. Any other currently-pending migration is
// left untouched and pending.
async function adoptBaseline(migrator, migrationNames = [BASELINE_MIGRATION_NAME]) {
  const pending = await migrator.pending();
  const toAdopt = pending.filter((migration) => migrationNames.includes(migration.name));
  for (const migration of toAdopt) {
    await migrator.storage.logMigration({ name: migration.name });
  }
  return toAdopt.map((migration) => migration.name);
}

async function run(argv = process.argv.slice(2)) {
  const migrator = buildMigrator();

  if (argv[0] === 'adopt-baseline') {
    const explicitNames = argv.slice(1);
    const adopted = await adoptBaseline(migrator, explicitNames.length > 0 ? explicitNames : undefined);
    console.log(
      adopted.length > 0
        ? `Adopted baseline: marked ${adopted.join(', ')} as applied (no DDL executed).`
        : 'Nothing to adopt — no pending migrations matched the requested scope.'
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

module.exports = { run, adoptBaseline, BASELINE_MIGRATION_NAME };
