export class EmailConfirmationToken {
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
}
