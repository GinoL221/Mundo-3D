import { EmailConfirmationMailIntent, MailPort } from '../../domain/ports/MailPort';
import { BrevoHttpConfig } from '../config/emailConfirmationConfig';
import { renderEmailConfirmationTemplate } from './emailConfirmationTemplate';
import { SmtpTransportFailure } from './NodemailerSmtpMailAdapter';

const BREVO_SMTP_EMAIL_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const BREVO_REQUEST_TIMEOUT_MS = 10000;

interface BrevoSender {
  name?: string;
  email: string;
}

function parseSender(from: string): BrevoSender {
  const trimmed = from.trim();
  const angleMatch = /^(.*)<([^<>]+)>$/.exec(trimmed);
  if (angleMatch) {
    const rawName = angleMatch[1]
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .trim();
    const email = angleMatch[2].trim();
    return rawName ? { name: rawName, email } : { email };
  }
  return { email: trimmed };
}

export class BrevoHttpMailAdapter implements MailPort {
  constructor(
    private readonly config: BrevoHttpConfig,
    private readonly fetchFn?: typeof fetch,
  ) {}

  async sendEmailConfirmation(intent: EmailConfirmationMailIntent): Promise<void> {
    const rendered = renderEmailConfirmationTemplate(intent);
    const sender = parseSender(this.config.from);
    const doFetch = this.fetchFn ?? globalThis.fetch;

    let response: Response;
    try {
      response = await doFetch(BREVO_SMTP_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: {
          'api-key': this.config.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: [{ email: intent.to }],
          subject: rendered.subject,
          textContent: rendered.text,
          htmlContent: rendered.html,
        }),
        signal: AbortSignal.timeout(BREVO_REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new SmtpTransportFailure();
    }

    if (!response.ok) {
      throw new SmtpTransportFailure();
    }
  }
}

export function createBrevoHttpMailAdapter(
  config: BrevoHttpConfig,
  fetchFn?: typeof fetch,
): MailPort {
  return new BrevoHttpMailAdapter(config, fetchFn);
}
