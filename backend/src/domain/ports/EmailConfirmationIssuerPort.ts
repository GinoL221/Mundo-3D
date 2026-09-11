export interface EmailConfirmationIssuerPort {
  issueForUser(userId: number): Promise<void>;
}
