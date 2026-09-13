export class EmailConfirmationToken {
  private static readonly validityMs = 24 * 60 * 60 * 1000;

  constructor(
    public readonly idEmailConfirmationToken: number,
    public readonly idUser: number,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    public readonly consumedAt: Date | null,
    public readonly invalidatedAt: Date | null,
    public readonly activeSlot: number | null,
    public readonly createdAt: Date,
  ) {}

  static createPending({
    recordId,
    userId,
    tokenHash,
    now,
  }: {
    recordId: number;
    userId: number;
    tokenHash: string;
    now: Date;
  }): EmailConfirmationToken {
    return new EmailConfirmationToken(
      recordId,
      userId,
      tokenHash,
      new Date(now.getTime() + EmailConfirmationToken.validityMs),
      null,
      null,
      1,
      now,
    );
  }

  static deliveryIdempotencyKey(recordId: number): string {
    return `email-confirmation-token:${recordId}`;
  }
}
