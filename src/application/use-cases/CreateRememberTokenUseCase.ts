import { IRememberTokenRepository } from '../../domain/ports/IRememberTokenRepository';
import { ITokenHasher } from '../../domain/ports/ITokenHasher';
import { RememberToken } from '../../domain/entities/RememberToken';
import { RememberTokenDTO } from '../dtos/RememberTokenDTO';

export interface CreateRememberTokenInput {
  IDUser: number;
  PlainToken: string;
  DurationSeconds: number;
}

export class CreateRememberTokenUseCase {
  constructor(
    private readonly rememberTokenRepo: IRememberTokenRepository,
    private readonly tokenHasher: ITokenHasher
  ) {}

  async execute(input: CreateRememberTokenInput): Promise<RememberTokenDTO> {
    const hashedToken = this.tokenHasher.hash(input.PlainToken);
    const expiryDate = new Date(Date.now() + input.DurationSeconds * 1000);

    const tokenEntity = new RememberToken(
      0, // IDRememberToken is ignored/overwritten by the repository upon creation
      hashedToken,
      input.IDUser,
      expiryDate
    );

    const createdToken = await this.rememberTokenRepo.create(tokenEntity);

    return {
      IDRememberToken: createdToken.IDRememberToken,
      TokenHash: createdToken.TokenHash,
      IDUser: createdToken.IDUser,
      ExpiryDate: createdToken.ExpiryDate,
      CreatedAt: createdToken.CreatedAt,
    };
  }
}
