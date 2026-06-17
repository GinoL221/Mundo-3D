import { UserController } from '../../infrastructure/controllers/UserController';
import { SequelizeUserRepository } from '../../infrastructure/repositories/SequelizeUserRepository';
import { SequelizeRememberTokenRepository } from '../../infrastructure/repositories/SequelizeRememberTokenRepository';
import { BcryptPasswordHasher } from '../../infrastructure/security/BcryptPasswordHasher';
import { Sha256TokenHasher } from '../../infrastructure/security/Sha256TokenHasher';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { CreateRememberTokenUseCase } from '../../application/use-cases/CreateRememberTokenUseCase';
import { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase';
import { DeleteRememberTokenUseCase } from '../../application/use-cases/DeleteRememberTokenUseCase';

const userRepo = new SequelizeUserRepository();
const rememberTokenRepo = new SequelizeRememberTokenRepository();
const passwordHasher = new BcryptPasswordHasher();
const tokenHasher = new Sha256TokenHasher();

const authenticateUserUseCase = new AuthenticateUserUseCase(userRepo, passwordHasher);
const registerUserUseCase = new RegisterUserUseCase(userRepo, passwordHasher);
const createRememberTokenUseCase = new CreateRememberTokenUseCase(rememberTokenRepo, tokenHasher);
const deleteRememberTokenUseCase = new DeleteRememberTokenUseCase(rememberTokenRepo, tokenHasher);

const controller = new UserController(
  authenticateUserUseCase,
  registerUserUseCase,
  createRememberTokenUseCase,
  deleteRememberTokenUseCase
);

const logout = controller.logout;
export = logout;
