import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import { UserDTO } from '../dtos/UserDTO';

export class VerifyRememberTokenUseCase {
  constructor(
    private readonly rememberTokenRepo: RememberTokenRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly tokenHasher: TokenHasherPort
  ) {}

  async execute(plainToken: string): Promise<UserDTO | null> {
    const hashedToken = this.tokenHasher.hash(plainToken);
    const tokenRecord = await this.rememberTokenRepo.findByHash(hashedToken);

    if (!tokenRecord) {
      return null;
    }

    if (new Date() > tokenRecord.expiryDate) {
      await this.rememberTokenRepo.deleteByHash(hashedToken);
      return null;
    }

    const user = await this.userRepo.findById(tokenRecord.idUser);
    if (!user) {
      return null;
    }

    return {
      idUser: user.idUser,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      image: user.image,
      idRole: user.idRole,
      category: user.category,
    };
  }
}
