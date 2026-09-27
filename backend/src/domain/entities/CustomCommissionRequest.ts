export class CustomCommissionRequest {
  constructor(
    public readonly idCustomCommissionRequest: number,
    public readonly name: string,
    public readonly email: string,
    public readonly idea: string,
    public readonly idProduct: number | null,
    public readonly createdAt: Date,
    public readonly expiresAt: Date
  ) {}
}
