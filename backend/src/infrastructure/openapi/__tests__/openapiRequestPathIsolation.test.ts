import fs from 'fs';
import path from 'path';

// Guards the "Request-Path Isolation from the Generator" requirement: no
// code reachable from a live Express request may load `swagger-jsdoc`. This
// file requires ONLY the running app — never `openapiSpec.ts` or the
// generation script — so a fresh module registry (Jest isolates modules
// per test file) proves the request path alone never pulls it in.
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
