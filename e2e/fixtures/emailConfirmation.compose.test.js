import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./emailConfirmation.ts', import.meta.url), 'utf8');

test('starts Mailpit without recreating its container', () => {
  const invocation = source.match(/runCompose\('up',[^\n]+\);/)?.[0];

  assert.ok(invocation, 'expected a Mailpit Compose invocation');
  assert.match(invocation, /'--no-recreate'/);
  assert.ok(
    invocation.indexOf("'--no-recreate'") < invocation.indexOf("'mailpit'"),
    'expected --no-recreate before the mailpit service name',
  );
  assert.doesNotMatch(invocation, /'--force-recreate'/);
});
