import fs from 'fs';
import path from 'path';

// Guards the "Request-Path Isolation from the Generator" requirement: no
// code reachable from a live Express request may load `swagger-jsdoc`. This
// file requires ONLY the running app — never `openapiSpec.ts` or the
// generation script — so a fresh module registry (Jest isolates modules
// per test file) proves the request path alone never pulls it in.
// Deliberately carries NO explicit timeout, unlike the other tests that
// require the real app. The body below is synchronous, and `require` blocks
// the event loop, so Jest cannot interrupt it — a timeout here would look
// like protection while doing nothing (measured: 75s under CPU contention,
// still reported as passed). Making the test async would not help either;
// the require stays synchronous. The cost is the same app compile the other
// files pay, it simply cannot be bounded from inside Jest.
describe('Request-path isolation from the OpenAPI generator', () => {
  it('never loads swagger-jsdoc when only the running app is required', () => {
    require('../../../app');

    const loadedSwaggerJsdoc = Object.keys(require.cache).some((modulePath) =>
      modulePath.includes('swagger-jsdoc')
    );

    expect(loadedSwaggerJsdoc).toBe(false);
  });

  it('routes/api/index.ts source contains no swagger-jsdoc or openapiSpec import (static fallback check)', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'routes', 'api', 'index.ts'), 'utf-8');

    expect(source).not.toMatch(/swagger-jsdoc/);
    expect(source).not.toMatch(/openapiSpec/);
  });
});
