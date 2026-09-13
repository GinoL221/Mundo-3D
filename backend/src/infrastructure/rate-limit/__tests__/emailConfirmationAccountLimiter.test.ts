const { EmailConfirmationAccountLimiter } = require('../emailConfirmationAccountLimiter');

describe('EmailConfirmationAccountLimiter', () => {
  const now = { value: new Date('2026-10-02T12:00:00.000Z') };
  const limiter = () => new EmailConfirmationAccountLimiter({ now: () => now.value });

  it('allows exactly three account send reservations in a rolling hour', () => {
    const subject = limiter();

    expect(subject.reserve('eligible@example.com')).toBe(true);
    now.value = new Date(now.value.getTime() + 60_000);
    expect(subject.reserve('eligible@example.com')).toBe(true);
    now.value = new Date(now.value.getTime() + 60_000);
    expect(subject.reserve('eligible@example.com')).toBe(true);
    now.value = new Date(now.value.getTime() + 60_000);
    expect(subject.reserve('eligible@example.com')).toBe(false);
  });

  it('requires 60 seconds between reservations and expires the rolling-hour budget', () => {
    const subject = limiter();

    expect(subject.reserve('eligible@example.com')).toBe(true);
    now.value = new Date(now.value.getTime() + 59_000);
    expect(subject.reserve('eligible@example.com')).toBe(false);
    now.value = new Date(now.value.getTime() + 1_000);
    expect(subject.reserve('eligible@example.com')).toBe(true);
    now.value = new Date(now.value.getTime() + 60 * 60 * 1000);
    expect(subject.reserve('eligible@example.com')).toBe(true);
  });

  it('releases a pre-SMTP reservation without releasing retained delivery attempts', () => {
    const subject = limiter();

    expect(subject.reserve('eligible@example.com')).toBe(true);
    subject.release('eligible@example.com');
    expect(subject.reserve('eligible@example.com')).toBe(true);
  });

  it('releases the earlier verified-during-issuance reservation without reopening a later mail attempt', () => {
    const subject = limiter();

    expect(subject.reserve('eligible@example.com')).toBe(true);
    now.value = new Date(now.value.getTime() + 60_000);
    expect(subject.reserve('eligible@example.com')).toBe(true);

    subject.release('eligible@example.com');
    now.value = new Date(now.value.getTime() + 59_000);

    expect(subject.reserve('eligible@example.com')).toBe(false);
  });
});
