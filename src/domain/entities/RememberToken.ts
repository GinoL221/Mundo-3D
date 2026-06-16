export class RememberToken {
  constructor(
    public readonly IDRememberToken: number,
    public readonly TokenHash: string,
    public readonly IDUser: number,
    public readonly ExpiryDate: Date,
    public readonly CreatedAt?: Date | null
  ) {}
}
