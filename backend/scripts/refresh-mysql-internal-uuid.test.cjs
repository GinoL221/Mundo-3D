'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseInternalUuid } = require('./refresh-mysql-internal-uuid.cjs');

const id = 'a'.repeat(64);
const uuid = '12345678-1234-1234-1234-123456789abc';
const success = { containerId: id, code: 0, stdout: `${uuid}\n`, stderr: '' };
const failure = { message: 'Internal MySQL UUID observation invalid' };

test('accepts exactly one UUID from the explicitly identified synthetic container', () => {
  assert.equal(parseInternalUuid(id, { ...success, stdout: `${uuid.toUpperCase()}\n` }), uuid);
});

test('rejects absent, malformed, or mismatched container identities', () => {
  for (const [expected, observed] of [[undefined, success], [id + '\n', success], [id, { ...success, containerId: 'b'.repeat(64) }], [id, { ...success, containerId: undefined }]]) {
    assert.throws(() => parseInternalUuid(expected, observed), failure);
  }
});

test('rejects unsuccessful or ambiguous output without exposing diagnostics', () => {
  for (const observed of [null, { ...success, code: 1 }, { ...success, stderr: 'password=secret' }, { ...success, stdout: '' }, { ...success, stdout: `${uuid}\n${uuid}\n` }, { ...success, stdout: ` ${uuid}\n` }, { ...success, stdout: `${uuid}\n\n` }]) {
    assert.throws(() => parseInternalUuid(id, observed), error => {
      assert.equal(error.message, failure.message);
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});
