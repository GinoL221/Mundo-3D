export type EmailConfirmationIssuanceOutcome =
  | { outcome: 'issued' }
  | { outcome: 'not-eligible' }
  | { outcome: 'mail-failed' };

export interface EmailConfirmationIssuerPort {
  issueForUser(userId: number): Promise<EmailConfirmationIssuanceOutcome>;
}
