import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const adminProductFormSource = readFileSync(
  new URL('./AdminProductForm.astro', import.meta.url),
  'utf8',
);

describe('AdminProductForm submission contract', () => {
  it('uses method="post" with multipart encoding', () => {
    const form = adminProductFormSource.match(/<form\b[^>]*>/)?.[0] ?? '';

    expect(form).toMatch(/\bmethod="post"/i);
    expect(form).toMatch(/\benctype="multipart\/form-data"/i);
  });
});
