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
    expect(componentSource).toContain('role="status"');
    expect(componentSource).toContain('aria-live="polite"');
    expect(componentSource).toContain('tabindex="-1"');
    expect(componentSource).toContain('feedback.hidden = false');
    expect(componentSource).toContain('feedback.focus()');
    expect(componentSource).toContain('EmailConfirmationService.confirmFromCurrentLocation()');
  });

  it('presents pending, success, invalid, and retryable error states without duplicate submits', () => {
    expect(componentSource).toContain(
      "type FeedbackState = 'pending' | 'success' | 'invalid' | 'error' | 'resend-success'",
    );
    expect(componentSource).toContain('if (confirmationPending) return');
    expect(componentSource).toContain('if (resendPending || !resendEmail?.value) return');
    expect(componentSource).toContain("setFormPending(confirmationForm, true, 'Confirmando…')");
    expect(componentSource).toContain("setFormPending(resendForm, true, 'Solicitando…')");
    expect(componentSource).toContain('control.disabled = pending');
    expect(componentSource).toContain("'confirmed'");
    expect(componentSource).toContain("'invalid'");
    expect(componentSource).toContain('ConfirmationNetworkError');
    expect(componentSource).not.toMatch(/localStorage|sessionStorage|document\.cookie|analytics/i);
  });

  it('shows a login CTA only after successful confirmation and never redirects automatically', () => {
    expect(componentSource).toContain('href="/login"');
    expect(componentSource).toContain("'success', true");
    expect(componentSource).toContain('loginLink.hidden = !showLogin');
    expect(componentSource).not.toMatch(/location\.(assign|replace)|window\.location\s*=/);
  });

  it('submits resend email explicitly and uses non-enumerating acceptance copy', () => {
    expect(componentSource).toContain('id="resend-confirmation-form"');
    expect(componentSource).toContain('EmailConfirmationService.resend(');
    expect(componentSource).toContain('Si la cuenta es elegible');
    expect(componentSource).not.toContain('Te enviamos un correo');
    expect(componentSource).not.toMatch(/cuenta inexistente|cuenta verificada|límite alcanzado/i);
  });
});
