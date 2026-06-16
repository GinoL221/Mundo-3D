export class User {
  constructor(
    public readonly IDUser: number,
    public readonly FirstName: string,
    public readonly LastName: string,
    public readonly Email: string,
    public readonly Password: string,
    public readonly Image: string | null,
    public readonly IDRole?: number | null,
    public readonly Category?: string | null
  ) {}
}
