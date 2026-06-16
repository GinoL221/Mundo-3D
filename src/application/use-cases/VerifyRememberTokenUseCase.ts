import { IRememberTokenRepository } from '../../domain/ports/IRememberTokenRepository';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { ITokenHasher } from '../../domain/ports/ITokenHasher';
import { UserDTO } from '../dtos/UserDTO';

export class VerifyRememberTokenUseCase {
  constructor(
    private readonly rememberTokenRepo: IRememberTokenRepository,
    private readonly userRepo: IUserRepository,
    private readonly tokenHasher: ITokenHasher
  ) {}

  async execute(plainToken: string): Promise<UserDTO | null> {
    const hashedToken = this.tokenHasher.hash(plainToken);
    const tokenRecord = await this.rememberTokenRepo.findByHash(hashedToken);

    if (!tokenRecord) {
      return null;
    }

    if (new Date() > tokenRecord.ExpiryDate) {
      await this.rememberTokenRepo.deleteByHash(hashedToken);
      return null;
    }

    const user = await this.userRepo.findById(tokenRecord.IDUser);
    if (!user) {
      return null;
    }

    return {
      IDUser: user.IDUser,
      FirstName: user.FirstName,
      LastName: user.LastName,
      Email: user.Email,
      Image: user.Image,
      IDRole: user.IDRole,
      Category: user.Category,
    };
  }
}
