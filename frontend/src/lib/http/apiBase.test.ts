import { describe, expect, it } from 'vitest';
import { API_URL } from './apiBase';

// Characterization test for the move (design.md D6, task 3.2): `API_URL`'s
// expression is moved verbatim from `config.ts`. Under vitest's default
// `node` environment `window` is undefined, so this only exercises the
// `import.meta.env.PUBLIC_API_URL` branch — the same branch `frontend/.env`
// already pins to this exact value for every test run.
describe('API_URL', () => {
  it('resolves to the configured backend origin', () => {
    expect(API_URL).toBe('http://localhost:3031');
  });

  it('is a non-empty string', () => {
    expect(typeof API_URL).toBe('string');
    expect(API_URL.length).toBeGreaterThan(0);
  });
});
