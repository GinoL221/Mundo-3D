import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { PasswordHasherPort } from '../../domain/ports/PasswordHasherPort';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';
import { UserDTO } from '../dtos/UserDTO';

export interface AuthenticateUserInput {
  email: string;
  password?: string;
  passwordUser?: string;
}

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly passwordHasher: PasswordHasherPort
  ) {}

  async execute(input: AuthenticateUserInput): Promise<UserDTO> {
    const user = await this.userRepo.findByEmail(input.email);
    const plainPassword = input.password || input.passwordUser;

    if (!user) {
      // MEDIUM-3 of the auth security review: returning here without hashing
      // made an unknown email answer ~90ms sooner than a known one, so the
      // response time reported whether an account exists. Every branch below
      // returns the same message, and the message was never what leaked.
      //
      // Only when a password was actually supplied. A caller who sent none
      // already knows it, and spending the decoy here would invert the leak —
      // an unknown email would answer SLOWER than a known one, which returns
      // early on that same input.
      if (plainPassword) {
        await this.passwordHasher.compareAgainstDecoy(plainPassword);
      }
      throw new InvalidCredentialsException('El email o la contraseña no coinciden');
    }

    if (!plainPassword) {
      throw new InvalidCredentialsException('El email o la contraseña no coinciden');
    }

    const isMatch = await this.passwordHasher.compare(plainPassword, user.password);
    if (!isMatch) {
      throw new InvalidCredentialsException('El email o la contraseña no coinciden');
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
