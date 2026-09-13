import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(
  new URL('../../pages/confirm-email.astro', import.meta.url),
  'utf8',
);

describe('/confirm-email page source contract', () => {
  it('renders the neutral confirmation page without a mutation path during Astro rendering', () => {
    expect(pageSource).toContain("import Layout from '../layouts/Layout.astro'");
    expect(pageSource).toContain('EmailConfirmationForm');
    expect(pageSource).toContain('Confirmá tu correo electrónico');
    expect(pageSource).not.toMatch(
      /fetch\(|email-confirmation\/confirm|email-confirmation\/resend/,
    );
  });

  it('does not render or retain the opaque query token in page source', () => {
    expect(pageSource).not.toMatch(
      /Astro\.url\.searchParams|localStorage|sessionStorage|document\.cookie|analytics/i,
    );
  });
});
