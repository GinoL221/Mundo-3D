import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const loginFormSource = readFileSync(new URL('./LoginForm.astro', import.meta.url), 'utf8');
const registerFormSource = readFileSync(new URL('./RegisterForm.astro', import.meta.url), 'utf8');
const emailConfirmationFormSource = readFileSync(
  new URL('./EmailConfirmationForm.astro', import.meta.url),
  'utf8',
);

describe('auth forms fail-closed submission contract', () => {
  it('LoginForm uses method="post" and keeps submit disabled until the submit handler is attached', () => {
    const form = loginFormSource.match(/<form\b[^>]*>/)?.[0] ?? '';
    const submit = loginFormSource.match(/<button\b[^>]*id="login-btn"[^>]*>/)?.[0] ?? '';
    const handlerIndex = loginFormSource.indexOf("form?.addEventListener('submit'");
    const topLevelEnableIndex = loginFormSource.indexOf(
      'if (form && loginBtn) loginBtn.disabled = false;',
    );

    expect(form).toMatch(/\bmethod="post"/i);
    expect(submit).toMatch(/\bdisabled\b/);
    expect(handlerIndex).toBeGreaterThan(-1);
    expect(topLevelEnableIndex).toBeGreaterThan(handlerIndex);
  });

  it('RegisterForm uses method="post" with multipart encoding and keeps submit disabled until the submit handler is attached', () => {
    const form = registerFormSource.match(/<form\b[^>]*>/)?.[0] ?? '';
    const submit = registerFormSource.match(/<button\b[^>]*id="register-btn"[^>]*>/)?.[0] ?? '';
    const handlerIndex = registerFormSource.indexOf("form?.addEventListener('submit'");
    const topLevelEnableIndex = registerFormSource.indexOf(
      'if (form && registerBtn) registerBtn.disabled = false;',
    );

    expect(form).toMatch(/\bmethod="post"/i);
    expect(form).toMatch(/\benctype="multipart\/form-data"/i);
    expect(submit).toMatch(/\bdisabled\b/);
    expect(handlerIndex).toBeGreaterThan(-1);
    expect(topLevelEnableIndex).toBeGreaterThan(handlerIndex);
  });

  it('EmailConfirmationForm uses method="post", names the resend form, and enables submit controls only after handlers attach', () => {
    const confirmForm =
      emailConfirmationFormSource.match(/<form\b[^>]*id="email-confirmation-form"[^>]*>/)?.[0] ??
      '';
    const resendForm =
      emailConfirmationFormSource.match(/<form\b[^>]*id="resend-confirmation-form"[^>]*>/)?.[0] ??
      '';
    const confirmBtn =
      emailConfirmationFormSource.match(/<button\b[^>]*id="confirm-email-btn"[^>]*>/)?.[0] ?? '';
    const resendBtn =
      emailConfirmationFormSource.match(/<button\b[^>]*id="resend-confirmation-btn"[^>]*>/)?.[0] ??
      '';

    const confirmHandlerIndex = emailConfirmationFormSource.indexOf(
      "confirmationForm?.addEventListener('submit'",
    );
    const confirmEnableIndex = emailConfirmationFormSource.indexOf(
      'if (confirmationForm && confirmBtn && hasToken) confirmBtn.disabled = false;',
    );
    const resendHandlerIndex = emailConfirmationFormSource.indexOf(
      "resendForm?.addEventListener('submit'",
    );
    const resendEnableIndex = emailConfirmationFormSource.indexOf(
      'if (resendForm && resendBtn) resendBtn.disabled = false;',
    );

    expect(confirmForm).toMatch(/\bmethod="post"/i);
    expect(resendForm).toMatch(/\bmethod="post"/i);
    expect(resendForm).toMatch(/\baria-labelledby="resend-form-title"/);
    expect(confirmBtn).toMatch(/\bdisabled\b/);
    expect(resendBtn).toMatch(/\bdisabled\b/);
    expect(confirmHandlerIndex).toBeGreaterThan(-1);
    expect(confirmEnableIndex).toBeGreaterThan(confirmHandlerIndex);
    expect(resendHandlerIndex).toBeGreaterThan(-1);
    expect(resendEnableIndex).toBeGreaterThan(resendHandlerIndex);
  });
});
