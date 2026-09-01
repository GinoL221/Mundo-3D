// Keeps `crypto` (a Node built-in) out of the application layer — mirrors
// `TokenHasherPort`'s reasoning for `SHA-256` hashing. Used by
// `CreateRememberTokenUseCase` to generate `family_id` (design.md D1).
export interface IdGeneratorPort {
  generate(): string;
}
