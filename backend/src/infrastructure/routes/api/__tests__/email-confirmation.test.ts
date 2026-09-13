import request from 'supertest';
import express from 'express';
import { InvalidEmailConfirmationToken } from '../../../../domain/exceptions/InvalidEmailConfirmationToken';

// Route composition validates the real startup configuration. This test supplies
// only local, non-secret transport values before the router module is loaded.
process.env.PUBLIC_APP_URL = 'http://localhost:4321';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_FROM = 'noreply@example.test';

const execute = jest.fn().mockResolvedValue({ outcome: 'confirmed' });
const resendExecute = jest.fn().mockResolvedValue({ outcome: 'accepted' });
jest.mock('../../../../application/use-cases/ConfirmEmailUseCase', () => ({
  ConfirmEmailUseCase: jest.fn().mockImplementation(() => ({ execute })),
}));
jest.mock('../../../../application/use-cases/ResendEmailConfirmationUseCase', () => ({
  ResendEmailConfirmationUseCase: jest.fn().mockImplementation(() => ({ execute: resendExecute })),
}));

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', require('../users').default);
  return app;
};

describe('email confirmation API contract', () => {
  beforeEach(() => {
    execute.mockReset().mockResolvedValue({ outcome: 'confirmed' });
    resendExecute.mockReset().mockResolvedValue({ outcome: 'accepted' });
  });

  it('rejects every bounded invalid POST body with one generic contract', async () => {
    const responses = await Promise.all(
      [undefined, 7, 'bad', 'x'.repeat(513)].map((token) =>
        request(buildApp()).post('/api/users/email-confirmation/confirm').send({ token }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400]);
    expect(responses.map((response) => response.body)).toEqual(Array(4).fill(responses[0].body));
  });

  it('makes unknown, expired, and superseded POST failures observably identical', async () => {
    const plaintext = 'opaque-token-should-not-escape';
    const email = 'private@example.com';
    const digest = 'a'.repeat(64);
    const confirmationUrl = `https://app.example/confirm-email?token=${plaintext}`;
    execute
      .mockRejectedValueOnce(
        new InvalidEmailConfirmationToken(
          `unknown ${plaintext} ${email} ${digest} ${confirmationUrl}`,
        ),
      )
      .mockRejectedValueOnce(
        new InvalidEmailConfirmationToken(
          `expired ${plaintext} ${email} ${digest} ${confirmationUrl}`,
        ),
      )
      .mockRejectedValueOnce(
        new InvalidEmailConfirmationToken(
          `superseded ${plaintext} ${email} ${digest} ${confirmationUrl}`,
        ),
      );

    const responses = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(buildApp())
          .post('/api/users/email-confirmation/confirm')
          .send({ token: plaintext }),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400]);
    expect(responses.map((response) => response.body)).toEqual(Array(3).fill(responses[0].body));
    const serializedBodies = responses.map((response) => JSON.stringify(response.body)).join(' ');
    for (const forbidden of [
      plaintext,
      email,
      digest,
      confirmationUrl,
      'unknown',
      'expired',
      'superseded',
    ]) {
      expect(serializedBodies).not.toContain(forbidden);
    }
  });

  it('does not register GET /confirm-email as a mutation path', async () => {
    const plaintext = 'opaque-token-should-not-escape';

    const response = await request(buildApp()).get(`/confirm-email?token=${plaintext}`);

    expect(response.status).toBe(404);
    expect(execute).not.toHaveBeenCalled();
    expect(response.text).not.toContain(plaintext);
  });

  it('accepts no GET mutation path under the API router', async () => {
    const response = await request(buildApp()).get(
      '/api/users/email-confirmation/confirm?token=opaque-confirmation-token',
    );
    expect(response.status).toBe(404);
    expect(execute).not.toHaveBeenCalled();
    expect(response.text).not.toContain('opaque-confirmation-token');
  });

  it('requires a POST body token before a valid confirmation can return 204', async () => {
    const response = await request(buildApp())
      .post('/api/users/email-confirmation/confirm')
      .send({ token: 'opaque-confirmation-token' });
    expect(response.status).toBe(204);
  });

  it('maps absent, verified, eligible, and IP-limited resend outcomes to one generic 202 body', async () => {
    const email = 'private@example.com';
    const token = 'opaque-token-should-not-escape';
    const digest = 'a'.repeat(64);
    const url = `https://app.example/confirm-email?token=${token}`;
    resendExecute
      .mockResolvedValueOnce({ outcome: 'accepted', state: 'absent' })
      .mockResolvedValueOnce({ outcome: 'accepted', state: 'verified' })
      .mockResolvedValueOnce({ outcome: 'accepted', state: 'eligible' })
      .mockResolvedValueOnce({ outcome: 'accepted', state: 'limited' });

    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(buildApp()).post('/api/users/email-confirmation/resend').send({ email }),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([202, 202, 202, 202]);
    expect(responses.map((response) => response.body)).toEqual(Array(4).fill(responses[0].body));
    const serializedBodies = responses.map((response) => JSON.stringify(response.body)).join(' ');
    for (const forbidden of [email, token, digest, url, 'absent', 'verified', 'limited']) {
      expect(serializedBodies).not.toContain(forbidden);
    }
  });
});
