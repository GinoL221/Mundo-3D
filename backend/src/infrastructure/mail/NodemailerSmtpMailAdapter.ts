import nodemailer, { Transporter } from 'nodemailer';
import { MailPort, EmailConfirmationMailIntent } from '../../domain/ports/MailPort';
import { SmtpConfig } from '../config/emailConfirmationConfig';
import { renderEmailConfirmationTemplate } from './emailConfirmationTemplate';

export class SmtpTransportFailure extends Error {
  readonly outcome = 'smtp_failed';

  constructor() {
    super('smtp_failed');
    this.name = 'SmtpTransportFailure';
  }
}

export interface SmtpTransportPort {
  sendMail(message: unknown): Promise<unknown>;
}

export class NodemailerSmtpMailAdapter implements MailPort {
  constructor(
    private readonly input: {
      transport: SmtpTransportPort;
      from: string;
    },
  ) {}

  async sendEmailConfirmation(intent: EmailConfirmationMailIntent): Promise<void> {
    const template = renderEmailConfirmationTemplate(intent);

    try {
      await this.input.transport.sendMail({
        from: this.input.from,
        to: intent.to,
        subject: template.subject,
        text: template.text,
        html: template.html,
        headers: { 'X-Idempotency-Key': intent.idempotencyKey },
      });
    } catch {
      throw new SmtpTransportFailure();
    }
  }
}

export function createNodemailerSmtpMailAdapter(config: SmtpConfig): MailPort {
  const transport: Transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });

  return new NodemailerSmtpMailAdapter({ transport, from: config.from });
}
