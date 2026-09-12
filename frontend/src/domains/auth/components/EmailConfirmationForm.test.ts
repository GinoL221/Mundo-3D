import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const componentSource = readFileSync(
  new URL('./EmailConfirmationForm.astro', import.meta.url),
  'utf8',
);

describe('EmailConfirmationForm source contract', () => {
  it('provides an explicit confirmation submit control and keyboard-focused live feedback', () => {
    expect(componentSource).toContain('id="email-confirmation-form"');
    expect(componentSource).toContain('type="submit"');
    expect(componentSource).toContain('aria-live="polite"');
    expect(componentSource).toContain('tabindex="-1"');
    expect(componentSource).toContain('feedback.hidden = false');
    expect(componentSource).toContain('feedback.focus()');
    expect(componentSource).toContain('EmailConfirmationService.confirmFromCurrentLocation()');
  });

  it('keeps confirmation outcomes distinct without persisting the opaque token', () => {
    expect(componentSource).toContain("'confirmed'");
    expect(componentSource).toContain("'invalid'");
    expect(componentSource).toContain('ConfirmationNetworkError');
    expect(componentSource).not.toMatch(/localStorage|sessionStorage|document\.cookie|analytics/i);
  });

  it('submits resend email explicitly and uses non-enumerating acceptance copy', () => {
    expect(componentSource).toContain('id="resend-confirmation-form"');
    expect(componentSource).toContain('EmailConfirmationService.resend(');
    expect(componentSource).toContain('Si la cuenta es elegible');
    expect(componentSource).not.toContain('Te enviamos un correo');
    expect(componentSource).not.toMatch(/cuenta inexistente|cuenta verificada|límite alcanzado/i);
  });
});
