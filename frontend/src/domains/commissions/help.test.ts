import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('../../pages/help.astro', import.meta.url), 'utf8');
const product = readFileSync(new URL('../../../../PRODUCT.md', import.meta.url), 'utf8');

describe('commission intake privacy contract', () => {
  it('fails closed unless the client submit handler is installed', () => {
    const form = page.match(/<form\b[^>]*>/)?.[0] ?? '';
    const submit = page.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0] ?? '';
    const handler = page.indexOf("form?.addEventListener('submit'");
    expect(form).toMatch(/\bmethod="post"/);
    expect(form).toMatch(/\baction="\/help"/);
    expect(submit).toContain('disabled');
    expect(page.indexOf('submitButton.disabled = false')).toBeGreaterThan(handler);
  });
  it('lists collected fields in product documentation', () => {
    expect(product.match(/^- Public custom commission request intake[^\n]*/m)?.[0]).toMatch(
      /name.*email.*idea/,
    );
  });
});
