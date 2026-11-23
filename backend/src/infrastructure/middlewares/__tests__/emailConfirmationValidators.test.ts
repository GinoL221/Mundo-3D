import { Request } from 'express';
import { validationResult } from 'express-validator';
import { resendEmailConfirmationValidation } from '../validators/emailConfirmationValidators';

async function runResendValidation(body: Record<string, unknown>) {
  const req = { body } as unknown as Request;
  for (const validation of resendEmailConfirmationValidation) {
    await validation.run(req);
  }
  return validationResult(req);
}

describe('resendEmailConfirmationValidation', () => {
  it('rejects a malformed email with a voseo field message on `email`', async () => {
    const errors = await runResendValidation({ email: 'a@b.c' });
    expect(errors.isEmpty()).toBe(false);
    expect(errors.mapped().email?.msg).toBe('Ingresá un correo válido');
  });

  it('rejects a missing email with the same message', async () => {
    const errors = await runResendValidation({});
    expect(errors.mapped().email?.msg).toBe('Ingresá un correo válido');
  });

  it('accepts a well-formed email', async () => {
    const errors = await runResendValidation({ email: 'ana@example.com' });
    expect(errors.isEmpty()).toBe(true);
  });
});
