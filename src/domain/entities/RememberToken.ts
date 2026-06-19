export class RememberToken {
  constructor(
    public readonly idRememberToken: number,
    public readonly tokenHash: string,
    public readonly idUser: number,
    public readonly expiryDate: Date,
    public readonly createdAt?: Date | null
  ) {}
}
