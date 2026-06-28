export interface RememberTokenDTO {
  idRememberToken: number;
  tokenHash: string;
  idUser: number;
  expiryDate: Date;
  createdAt?: Date | null;
}
