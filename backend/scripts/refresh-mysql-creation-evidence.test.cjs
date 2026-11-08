'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileCreationEvidence } = require('./refresh-mysql-creation-evidence.cjs');

const validContainerId = 'a'.repeat(64);
const validVolumeName = 'b'.repeat(64);

test('accepts confirmed creation evidence with matching container and single anonymous volume', () => {
  const result = reconcileCreationEvidence({
    createdContainerId: validContainerId,
    inspectedContainer: {
      Id: validContainerId,
      Mounts: [{ Type: 'volume', Name: validVolumeName, Destination: '/var/lib/mysql', RW: true }],
    },
  });

  assert.deepEqual(result, {
    status: 'confirmed',
    containerId: validContainerId,
    volumeName: validVolumeName,
  });
});

test('marks evidence as uncertain when creation returned no ID or an invalid ID', () => {
  for (const badId of [undefined, null, '', 'short', validContainerId + '\n', 123]) {
    const outcome = reconcileCreationEvidence({
      createdContainerId: badId,
      inspectedContainer: null,
    });
    assert.equal(outcome.status, 'uncertain');
    assert.equal(outcome.containerId, null);
    assert.equal(outcome.volumeName, null);
    assert.equal(outcome.cleanupPermitted, false);
  }
});

test('identifies untrusted candidates on inspection failure but forbids automatic cleanup', () => {
  const outcome = reconcileCreationEvidence({
    createdContainerId: validContainerId,
    inspectedContainer: {
      Id: validContainerId,
      Mounts: [
        { Type: 'volume', Name: validVolumeName, Destination: '/var/lib/mysql', RW: true },
        { Type: 'bind', Source: '/host/path', Destination: '/extra' },
      ],
    },
  });

  assert.equal(outcome.status, 'uncertain');
  assert.equal(outcome.containerId, null);
  assert.equal(outcome.volumeName, null);
  assert.equal(outcome.cleanupPermitted, false);
  assert.deepEqual(outcome.untrustedCandidates, {
    containerIds: [validContainerId],
    volumeNames: [validVolumeName],
  });
});

test('rejects unexpected container ID in inspection even if creation returned an ID', () => {
  const mismatchedId = 'c'.repeat(64);
  const outcome = reconcileCreationEvidence({
    createdContainerId: validContainerId,
    inspectedContainer: {
      Id: mismatchedId,
      Mounts: [{ Type: 'volume', Name: validVolumeName, Destination: '/var/lib/mysql', RW: true }],
    },
  });

  assert.equal(outcome.status, 'uncertain');
  assert.equal(outcome.containerId, null);
  assert.equal(outcome.volumeName, null);
  assert.equal(outcome.cleanupPermitted, false);
});
