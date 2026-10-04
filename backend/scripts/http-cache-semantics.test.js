'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');

const astroDirectory = fs.realpathSync(
  path.resolve(__dirname, '../../frontend/node_modules/astro'),
);
const astroPackage = require(path.join(astroDirectory, 'package.json'));
assert.equal(astroPackage.version, '7.3.1');
const astroRequire = createRequire(path.join(astroDirectory, 'package.json'));
const cacheSemanticsPath = astroRequire.resolve('http-cache-semantics');
const cacheSemanticsPackage = require(path.join(path.dirname(cacheSemanticsPath), 'package.json'));
assert.equal(cacheSemanticsPackage.version, '4.2.0');
const CachePolicy = astroRequire('http-cache-semantics');

const now = 1_700_000_000_000;
const request = { url: 'https://cache.test/resource', headers: { host: 'cache.test' } };

function policy(cacheControl, extraHeaders = {}, options = {}, elapsed = 0) {
  let clock = now;
  class FixedClockCachePolicy extends CachePolicy {
    now() {
      return clock;
    }
  }
  const req = {
    ...request,
    headers: {
      ...request.headers,
      ...(extraHeaders.authorization ? { authorization: extraHeaders.authorization } : {}),
    },
  };
  const instance = new FixedClockCachePolicy(
    req,
    {
      status: 200,
      headers: {
        date: new Date(now).toUTCString(),
        'cache-control': cacheControl,
        ...extraHeaders,
      },
    },
    options,
  );
  clock += elapsed;
  return instance;
}

for (const maxStale of ['', '=999999']) {
  for (const [reason, control, headers, options] of [
    [
      'shared Set-Cookie without explicit public or immutable',
      'max-age=60',
      { 'set-cookie': 'session=placeholder' },
      {},
    ],
    ['shared proxy-revalidate', 'max-age=60, proxy-revalidate', {}, {}],
    ['response no-cache', 'max-age=60, no-cache', {}, {}],
    ['non-storable no-store response', 'max-age=60, no-store', {}, {}],
    ['non-storable private shared response', 'max-age=60, private', {}, {}],
    [
      'authenticated shared response without an allowing directive',
      'max-age=60',
      { authorization: 'Bearer placeholder' },
      {},
    ],
  ]) {
    test(`security: max-stale ${maxStale || '(bare)'} cannot serve ${reason}`, () => {
      const instance = policy(control, headers, { shared: true }, 1_000_000);
      const req = {
        ...request,
        headers: {
          ...request.headers,
          ...options.requestHeaders,
          'cache-control': `max-stale${maxStale}`,
        },
      };
      assert.equal(instance.maxAge(), 0);
      const result = instance.evaluateRequest(req);
      assert.equal(result.response, undefined);
      assert.equal(result.revalidation.synchronous, true);
      assert.equal(instance.satisfiesWithoutRevalidation(req), false);
    });
  }
}

test('compatibility: ordinary expired response is served within bare max-stale allowance', () => {
  const instance = policy('max-age=60', {}, {}, 61_000);
  assert.notEqual(
    instance.evaluateRequest({
      ...request,
      headers: { ...request.headers, 'cache-control': 'max-stale' },
    }).response,
    undefined,
  );
});

test('compatibility: numeric max-stale bound below response staleness requires synchronous revalidation', () => {
  const instance = policy('max-age=60', {}, {}, 62_000);
  const result = instance.evaluateRequest({
    ...request,
    headers: { ...request.headers, 'cache-control': 'max-stale=1' },
  });
  assert.equal(result.response, undefined);
  assert.equal(result.revalidation.synchronous, true);
});

test('compatibility: fresh ordinary response remains immediately reusable', () => {
  const instance = policy('max-age=60');
  assert.notEqual(instance.evaluateRequest(request).response, undefined);
});

test('compatibility: shared Set-Cookie is reusable with explicit public or immutable', () => {
  for (const control of ['max-age=60, public', 'max-age=60, immutable']) {
    const instance = policy(control, { 'set-cookie': 'session=placeholder' });
    assert.ok(instance.maxAge() > 0, control);
  }
});

test('compatibility: private cache may reuse a Set-Cookie response', () => {
  const instance = policy('max-age=60', { 'set-cookie': 'session=placeholder' }, { shared: false });
  assert.equal(instance.maxAge(), 60);
});

test('compatibility: stale-while-revalidate offers async response but not a no-revalidation hit', () => {
  const instance = policy('max-age=60, stale-while-revalidate=30', {}, {}, 61_000);
  const result = instance.evaluateRequest(request);
  assert.notEqual(result.response, undefined);
  assert.equal(result.revalidation.synchronous, false);
  assert.equal(instance.satisfiesWithoutRevalidation(request), false);
});

test('compatibility: Vary star cannot be bypassed by max-stale', () => {
  const instance = policy('max-age=60', { vary: '*' }, {}, 61_000);
  assert.equal(instance.maxAge(), 0);
  const result = instance.evaluateRequest({
    ...request,
    headers: { ...request.headers, 'cache-control': 'max-stale' },
  });
  assert.equal(result.response, undefined);
});

test('compatibility: must-revalidate remains a miss even while fresh', () => {
  const instance = policy('max-age=60, must-revalidate');
  assert.equal(instance.evaluateRequest(request).response, undefined);
});
