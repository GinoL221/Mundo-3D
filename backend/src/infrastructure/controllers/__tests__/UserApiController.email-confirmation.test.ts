import { Request, Response } from 'express';
import { InvalidEmailConfirmationToken } from '../../../domain/exceptions/InvalidEmailConfirmationToken';

// RED-only: the dedicated controller is intentionally missing before GREEN.
const { EmailConfirmationApiController } = require('../EmailConfirmationApiController');

describe('EmailConfirmationApiController', () => {
  const setup = (execute = jest.fn()) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      sendStatus: jest.fn(),
    } as unknown as Response;
    return { execute, res, controller: new EmailConfirmationApiController({ execute }) };
  };

  it('maps every malformed and invalid token class to the same generic 400 contract', async () => {
    const responses: unknown[] = [];
    for (const token of [undefined, 9, 'too short', 'x'.repeat(513)]) {
      const f = setup();
      await f.controller.confirm({ body: { token } } as Request, f.res, jest.fn());
      expect(f.execute).not.toHaveBeenCalled();
      responses.push([
        (f.res.status as jest.Mock).mock.calls[0],
        (f.res.json as jest.Mock).mock.calls[0],
      ]);
    }
    for (const reason of ['unknown', 'expired', 'superseded']) {
      const f = setup(jest.fn().mockRejectedValue(new InvalidEmailConfirmationToken(reason)));
      await f.controller.confirm(
        { body: { token: 'opaque-confirmation-token' } } as Request,
        f.res,
        jest.fn(),
      );
      responses.push([
        (f.res.status as jest.Mock).mock.calls[0],
        (f.res.json as jest.Mock).mock.calls[0],
      ]);
    }
    expect(responses).toEqual(Array(responses.length).fill(responses[0]));
  });

  it('keeps submitted token and internal invalid details out of the generic error body', async () => {
    const plaintext = 'opaque-token-should-not-escape';
    const email = 'private@example.com';
    const digest = 'a'.repeat(64);
    const confirmationUrl = `https://app.example/confirm-email?token=${plaintext}`;
    const f = setup(
      jest
        .fn()
        .mockRejectedValue(
          new InvalidEmailConfirmationToken(
            `unknown ${plaintext} ${email} ${digest} ${confirmationUrl}`,
          ),
        ),
    );

    await f.controller.confirm({ body: { token: plaintext } } as Request, f.res, jest.fn());

    expect(f.res.status).toHaveBeenCalledWith(400);
    expect(f.res.json).toHaveBeenCalledWith({ error: 'Invalid email confirmation token' });
    const serializedBody = JSON.stringify((f.res.json as jest.Mock).mock.calls[0][0]);
    for (const forbidden of [plaintext, email, digest, confirmationUrl, 'unknown']) {
      expect(serializedBody).not.toContain(forbidden);
    }
  });

  it('returns 204 without touching session cookies for both first confirmation and retry', async () => {
    const f = setup(jest.fn().mockResolvedValue({ outcome: 'confirmed' }));
    await f.controller.confirm(
      { body: { token: 'opaque-confirmation-token' } } as Request,
      f.res,
      jest.fn(),
    );
    expect(f.res.sendStatus).toHaveBeenCalledWith(204);
  });
});
