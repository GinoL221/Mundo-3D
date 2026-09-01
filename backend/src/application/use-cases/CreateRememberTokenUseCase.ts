import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import { IdGeneratorPort } from '../../domain/ports/IdGeneratorPort';
import { RememberToken } from '../../domain/entities/RememberToken';
import { RememberTokenDTO } from '../dtos/RememberTokenDTO';

export interface CreateRememberTokenInput {
  idUser: number;
  plainToken: string;
  durationSeconds: number;
}

export class CreateRememberTokenUseCase {
  constructor(
    private readonly rememberTokenRepo: RememberTokenRepositoryPort,
    private readonly tokenHasher: TokenHasherPort,
    private readonly idGenerator: IdGeneratorPort
  ) {}

  async execute(input: CreateRememberTokenInput): Promise<RememberTokenDTO> {
    const hashedToken = this.tokenHasher.hash(input.plainToken);
    const expiryDate = new Date(Date.now() + input.durationSeconds * 1000);
    // One login's rotation chain (design.md D1). Written now even though
    // reuse-revocation logic is deferred — see proposal.md decision #1.
    const familyId = this.idGenerator.generate();

    const tokenEntity = new RememberToken(
      0, // idRememberToken is ignored/overwritten by the repository upon creation
      hashedToken,
      input.idUser,
      expiryDate,
      undefined,
      familyId
    );

    const createdToken = await this.rememberTokenRepo.create(tokenEntity);

    return {
      idRememberToken: createdToken.idRememberToken,
      tokenHash: createdToken.tokenHash,
      idUser: createdToken.idUser,
      expiryDate: createdToken.expiryDate,
      createdAt: createdToken.createdAt,
      familyId: createdToken.familyId,
    };
  }
}
