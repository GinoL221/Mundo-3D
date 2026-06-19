export class User {
  constructor(
    public readonly idUser: number,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: string,
    public readonly password: string,
    public readonly image: string | null,
    public readonly idRole?: number | null,
    public readonly category?: string | null
  ) {}
}
