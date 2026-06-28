import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';
import { UserDTO } from '../dtos/UserDTO';

export interface AuthenticateUserInput {
  email: string;
  password?: string;
  passwordUser?: string;
}

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(input: AuthenticateUserInput): Promise<UserDTO> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw new InvalidCredentialsException('El email o la contraseña no coinciden');
    }

    const plainPassword = input.password || input.passwordUser;
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
