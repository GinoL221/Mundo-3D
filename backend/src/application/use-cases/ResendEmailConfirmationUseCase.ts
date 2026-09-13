import { NormalizedEmail } from '../../domain/entities/NormalizedEmail';
import { EmailConfirmationIssuerPort } from '../../domain/ports/EmailConfirmationIssuerPort';
import { EmailConfirmationRateLimitPort } from '../../domain/ports/EmailConfirmationRateLimitPort';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';

export class ResendEmailConfirmationUseCase {
  constructor(
    private readonly users: Pick<UserRepositoryPort, 'findByEmail'>,
    private readonly issuer: EmailConfirmationIssuerPort,
    private readonly limiter: EmailConfirmationRateLimitPort,
  ) {}

  async execute({ email }: { email: string }): Promise<{ outcome: 'accepted' }> {
    const normalizedEmail = NormalizedEmail.from(email).value;
    const user = await this.users.findByEmail(normalizedEmail);

    if (!user || user.emailVerifiedAt) {
      return { outcome: 'accepted' };
    }

    if (!this.limiter.reserve(normalizedEmail)) {
      return { outcome: 'accepted' };
    }

    try {
      const result = await this.issuer.issueForUser(user.idUser);
      if (result.outcome === 'not-eligible') {
        this.limiter.release(normalizedEmail);
      }
    } catch {
      this.limiter.release(normalizedEmail);
    }

    return { outcome: 'accepted' };
  }
}
