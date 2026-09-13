import { EmailConfirmationToken } from '../../domain/entities/EmailConfirmationToken';
import {
  EmailConfirmationIssuanceOutcome,
  EmailConfirmationIssuerPort,
} from '../../domain/ports/EmailConfirmationIssuerPort';
import { EmailConfirmationTokenRepositoryPort } from '../../domain/ports/EmailConfirmationTokenRepositoryPort';
import { TokenGeneratorPort } from '../../domain/ports/TokenGeneratorPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import { PublicOriginPort } from '../../domain/ports/PublicOriginPort';
import { MailPort } from '../../domain/ports/MailPort';
import { ClockPort } from '../../domain/ports/ClockPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';

export class IssueEmailConfirmationUseCase implements EmailConfirmationIssuerPort {
  constructor(
    private readonly repository: EmailConfirmationTokenRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly generator: TokenGeneratorPort,
    private readonly hasher: TokenHasherPort,
    private readonly origin: PublicOriginPort,
    private readonly mail: MailPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async issueForUser(userId: number): Promise<EmailConfirmationIssuanceOutcome> {
    const plaintext = this.generator.generate();
    const tokenHash = this.hasher.hash(plaintext);
    const now = this.clock.now();
    const replacement = await this.unitOfWork.runInTransaction((tx) =>
      this.repository.replaceForUnverifiedUser({ userId, tokenHash, now, tx }),
    );

    if (!replacement) {
      return { outcome: 'not-eligible' };
    }

    const mailed = await this.sendAfterCommit(replacement.token, replacement.recipient, plaintext);
    return mailed ? { outcome: 'issued' } : { outcome: 'mail-failed' };
  }

  private async sendAfterCommit(
    token: EmailConfirmationToken,
    recipient: string,
    plaintext: string,
  ): Promise<boolean> {
    try {
      await this.mail.sendEmailConfirmation({
        to: recipient,
        confirmationUrl: this.origin.buildConfirmationUrl(plaintext),
        expiresAt: token.expiresAt,
        idempotencyKey: EmailConfirmationToken.deliveryIdempotencyKey(
          token.idEmailConfirmationToken,
        ),
      });
      return true;
    } catch {
      this.logger.warn({ outcome: 'smtp_failed', recordId: token.idEmailConfirmationToken });
      return false;
    }
  }
}
