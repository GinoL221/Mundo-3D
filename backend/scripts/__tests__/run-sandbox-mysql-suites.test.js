'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_MYSQL_IMAGE,
  CONTAINER_PREFIX,
  SUITE_GROUPS,
  generateDistinctPasswords,
  buildContainerName,
  buildDockerCreateArgs,
  buildGroupEnv,
  buildJestArgs,
} = require('../run-sandbox-mysql-suites.cjs');

describe('run-sandbox-mysql-suites', () => {
  it('defines all 4 sandbox MySQL suites across 3 dedicated ports with no collisions', () => {
    assert.equal(SUITE_GROUPS.length, 3);
    assert.deepEqual(SUITE_GROUPS.map((g) => g.port), [33316, 33317, 33318]);
    assert.deepEqual(SUITE_GROUPS.flatMap((g) => g.suites), [
      'src/infrastructure/database/__tests__/DemoSandboxProductRepositories.mysql.ts',
      'src/infrastructure/database/__tests__/sandboxReleasePinning.mysql.ts',
      'src/infrastructure/database/__tests__/DemoSandboxResetAdapter.mysql.ts',
      'src/infrastructure/database/__tests__/DemoSandboxHttpIsolation.mysql.ts',
    ]);
  });

  it('pins the exact MySQL 8.0 image digest used by CI', () => {
    assert.equal(
      DEFAULT_MYSQL_IMAGE,
      'mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b',
    );
  });

  it('generates three distinct 64-hex passwords and rejects collisions', () => {
    const passwords = generateDistinctPasswords();
    const values = [passwords.admin, passwords.slotA, passwords.slotB];
    for (const value of values) assert.match(value, /^[a-f0-9]{64}$/);
    assert.equal(new Set(values).size, 3);
    assert.throws(() => generateDistinctPasswords(() => Buffer.alloc(32, 0xaa)), /distinct/i);
  });

  it('builds unique scoped container names and rejects invalid identifiers', () => {
    assert.equal(buildContainerName('a1b2c3d4e5f6', 'cut1'), `${CONTAINER_PREFIX}-a1b2c3d4e5f6-cut1`);
    assert.throws(() => buildContainerName('bad/id', 'cut1'), /runId/i);
    assert.throws(() => buildContainerName('a1b2c3d4e5f6', 'bad group'), /groupId/i);
  });

  it('binds Docker containers strictly to 127.0.0.1 and never embeds passwords in argv', () => {
    const args = buildDockerCreateArgs({
      containerName: 'm3d-sandbox-mysql-abcdef123456-cut1',
      runId: 'abcdef123456',
      groupId: 'cut1',
      port: 33317,
      image: DEFAULT_MYSQL_IMAGE,
    });
    assert.ok(args.includes('--publish') && args.includes('127.0.0.1:33317:3306'));
    assert.ok(args.includes('--env') && args.includes('MYSQL_ROOT_PASSWORD'));
    assert.equal(args.some((arg) => arg.startsWith('MYSQL_ROOT_PASSWORD=')), false);
    assert.equal(args.at(-1), DEFAULT_MYSQL_IMAGE);
  });

  it('builds exact per-group environment variables and Jest command arguments', () => {
    const passwords = { admin: 'a'.repeat(64), slotA: 'b'.repeat(64), slotB: 'c'.repeat(64) };
    const serverUuid = '11111111-2222-3333-4444-555555555555';
    const env = buildGroupEnv(SUITE_GROUPS[0], { passwords, serverUuid });
    assert.equal(env.M3D_SANDBOX_TEST_AUTHORIZATION, 'm3d-sandbox-isolation-01a10377');
    assert.equal(env.M3D_SANDBOX_TEST_HOST, '127.0.0.1');
    assert.equal(env.M3D_SANDBOX_TEST_PORT, '33316');
    assert.equal(env.M3D_SANDBOX_TEST_CONTROL_DATABASE, 'm3d_sandbox_verify_control');
    assert.equal(env.M3D_SANDBOX_TEST_DATABASE_A, 'm3d_sandbox_verify_a');
    assert.equal(env.M3D_SANDBOX_TEST_DATABASE_B, 'm3d_sandbox_verify_b');
    assert.equal(env.M3D_SANDBOX_TEST_PINNING_DATABASE, 'm3d_sandbox_verify_pinning');
    assert.equal(env.M3D_SANDBOX_TEST_ADMIN_PASSWORD, passwords.admin);
    assert.equal(env.M3D_SANDBOX_TEST_PASSWORD_A, passwords.slotA);
    assert.equal(env.M3D_SANDBOX_TEST_PASSWORD_B, passwords.slotB);
    assert.equal(env.M3D_SANDBOX_TEST_SERVER_UUID, serverUuid);
    assert.throws(() => buildGroupEnv(SUITE_GROUPS[0], { passwords, serverUuid: 'bad' }), /UUID/i);
    assert.deepEqual(buildJestArgs(SUITE_GROUPS[1]), [
      'exec', 'jest', '--config', 'jest.sandbox.config.js', '--runInBand', '--detectOpenHandles',
      'src/infrastructure/database/__tests__/DemoSandboxResetAdapter.mysql.ts',
    ]);
  });
});
