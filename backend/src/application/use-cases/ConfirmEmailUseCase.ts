import { InvalidEmailConfirmationToken } from '../../domain/exceptions/InvalidEmailConfirmationToken';
import { ClockPort } from '../../domain/ports/ClockPort';
import { EmailConfirmationTokenRepositoryPort } from '../../domain/ports/EmailConfirmationTokenRepositoryPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import { UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';

export class ConfirmEmailUseCase {
  constructor(
    private readonly repository: EmailConfirmationTokenRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly hasher: TokenHasherPort,
    private readonly clock: ClockPort,
  ) {}

  async execute({ token }: { token: string }): Promise<{ outcome: 'confirmed' | 'idempotent' }> {
    const tokenHash = this.hasher.hash(token);
    const userId = await this.repository.findUserIdByTokenHash(tokenHash);
    if (!userId) {
      throw new InvalidEmailConfirmationToken();
    }

    const result = await this.unitOfWork.runInTransaction((tx) =>
      this.repository.verifyAndConsume({ userId, tokenHash, now: this.clock.now(), tx }),
    );
    if (result.outcome !== 'confirmed' && result.outcome !== 'idempotent') {
      throw new InvalidEmailConfirmationToken();
    }

    return { outcome: result.outcome };
  }
}
