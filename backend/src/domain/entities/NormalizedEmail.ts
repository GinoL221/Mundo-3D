export class NormalizedEmail {
  private constructor(public readonly value: string) {}

  static from(email: string): NormalizedEmail {
    return new NormalizedEmail(email.trim().toLowerCase());
  }
}
