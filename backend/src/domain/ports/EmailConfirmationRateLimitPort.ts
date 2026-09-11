export interface EmailConfirmationRateLimitPort {
  reserve(normalizedEmail: string): boolean;
  release(normalizedEmail: string): void;
}
