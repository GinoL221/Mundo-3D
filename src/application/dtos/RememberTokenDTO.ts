export interface RememberTokenDTO {
  IDRememberToken: number;
  TokenHash: string;
  IDUser: number;
  ExpiryDate: Date;
  CreatedAt?: Date | null;
}
