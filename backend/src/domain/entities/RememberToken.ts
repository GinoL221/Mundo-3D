export class RememberToken {
  constructor(
    public readonly idRememberToken: number,
    public readonly tokenHash: string,
    public readonly idUser: number,
    public readonly expiryDate: Date,
    public readonly createdAt?: Date | null,
    // Rotation metadata (HIGH-1 PR1, design.md D1/D2). Appended after the
    // pre-existing fields, all optional, so every pre-existing positional
    // constructor call in the codebase keeps compiling unchanged.
    public readonly familyId?: string | null,
    public readonly supersededAt?: Date | null,
    public readonly successorHash?: string | null,
    public readonly revokedAt?: Date | null
  ) {}
}
