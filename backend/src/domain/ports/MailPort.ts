export interface EmailConfirmationMailIntent {
  to: string;
  confirmationUrl: string;
  expiresAt: Date;
  idempotencyKey: string;
}

export interface MailPort {
  sendEmailConfirmation(intent: EmailConfirmationMailIntent): Promise<void>;
}
