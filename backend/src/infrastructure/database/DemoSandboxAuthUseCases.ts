import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { CreateRememberTokenUseCase } from '../../application/use-cases/CreateRememberTokenUseCase';
import { RefreshSessionUseCase } from '../../application/use-cases/RefreshSessionUseCase';
import { RevokeRefreshTokenUseCase } from '../../application/use-cases/RevokeRefreshTokenUseCase';
import { RotateRefreshTokenUseCase } from '../../application/use-cases/RotateRefreshTokenUseCase';
import type { IdGeneratorPort } from '../../domain/ports/IdGeneratorPort';
import type { LoggerPort } from '../../domain/ports/LoggerPort';
import type { PasswordHasherPort } from '../../domain/ports/PasswordHasherPort';
import type { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import type { DemoSandboxProductRepositories } from './DemoSandboxProductRepositories';

interface AuthDependencies {
  passwordHasher: PasswordHasherPort;
  tokenHasher: TokenHasherPort;
  idGenerator: IdGeneratorPort;
  logger: LoggerPort;
  reapSeconds: number;
}

/** Internal composition only. This does not validate a lease or authorize a request. */
export function createDemoSandboxAuthUseCases(
  repositories: DemoSandboxProductRepositories,
  slotId: string,
  dependencies: AuthDependencies,
) {
  const users = repositories.getUserRepository(slotId);
  const tokens = repositories.getRememberTokenRepository(slotId);
  const uow = repositories.getUnitOfWork(slotId);
  const rotate = new RotateRefreshTokenUseCase(
    uow,
    tokens,
    dependencies.tokenHasher,
    dependencies.reapSeconds,
  );
  return {
    authenticate: new AuthenticateUserUseCase(users, dependencies.passwordHasher),
    createRememberToken: new CreateRememberTokenUseCase(
      tokens,
      dependencies.tokenHasher,
      dependencies.idGenerator,
    ),
    refresh: new RefreshSessionUseCase(
      tokens,
      users,
      dependencies.tokenHasher,
      rotate,
      dependencies.logger,
    ),
    revoke: new RevokeRefreshTokenUseCase(tokens),
  };
}
