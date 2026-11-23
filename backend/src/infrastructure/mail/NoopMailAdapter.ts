import type { EmailConfirmationMailIntent, MailPort } from '../../domain/ports/MailPort';

/** Suppresses outbound email in Demo Sandbox contexts with zero network I/O. */
export class NoopMailAdapter implements MailPort {
  sendEmailConfirmation(_intent: EmailConfirmationMailIntent): Promise<void> {
    return Promise.resolve();
  }
}
