#!/usr/bin/env node
'use strict';

/**
 * Dev-only build-time generator for the committed OpenAPI contract artifact.
 *
 * Default mode runs the existing JSDoc-scan/spec-build pipeline
 * (`buildOpenApiSpec()`) once and writes `backend/openapi.json`. `--check`
 * mode regenerates the spec in memory only (no write) and compares it to the
 * committed file, exiting 1 with the exact fix command on drift — this is
 * the CI drift gate (`pnpm run check:openapi`).
 *
 * This is the ONLY code path allowed to import `swagger-jsdoc` (transitively,
 * via `buildOpenApiSpec()`): the running Express process never loads it.
 *
 * Usage:
 *   node scripts/generate-openapi-spec.js          (writes backend/openapi.json)
 *   node scripts/generate-openapi-spec.js --check  (CI drift gate, no write)
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_OUTPUT_PATH = path.join(__dirname, '..', 'openapi.json');
const CHECK_FIX_COMMAND = 'pnpm --filter backend generate:openapi';

function serializeSpec(spec) {
  return `${JSON.stringify(spec, null, 2)}\n`;
}

function generate({ outputPath = DEFAULT_OUTPUT_PATH, buildSpec }) {
  const content = serializeSpec(buildSpec());
  fs.writeFileSync(outputPath, content, 'utf8');
  return content;
}

function check({ outputPath = DEFAULT_OUTPUT_PATH, buildSpec }) {
  const expected = serializeSpec(buildSpec());
  const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;
  return { matches: actual === expected, expected, actual };
}

function runCli({ argv = process.argv.slice(2), outputPath = DEFAULT_OUTPUT_PATH, buildSpec, log = console.log }) {
  const isCheck = argv.includes('--check');

  if (isCheck) {
    const { matches } = check({ outputPath, buildSpec });
    if (!matches) {
      log(`[generate-openapi-spec] FAIL: ${outputPath} is stale. Run "${CHECK_FIX_COMMAND}" to regenerate it.`);
      return 1;
    }
    return 0;
  }

  generate({ outputPath, buildSpec });
  log(`[generate-openapi-spec] Wrote ${outputPath}`);
  return 0;
}

// Loads the TS source via ts-node (a devDependency, never present in a
// production install) so this dev-only script never requires a compiled
// build step of its own. Lazy so unit tests can inject a fake `buildSpec`
// without registering ts-node or scanning real route files.
function loadBuildOpenApiSpec() {
  require('ts-node/register');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../src/infrastructure/openapi/openapiSpec').buildOpenApiSpec;
}

if (require.main === module) {
  process.exitCode = runCli({ buildSpec: loadBuildOpenApiSpec() });
}

module.exports = {
  serializeSpec,
  generate,
  check,
  runCli,
  DEFAULT_OUTPUT_PATH,
  CHECK_FIX_COMMAND,
};
