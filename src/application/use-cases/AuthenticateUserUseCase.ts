import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';
import { UserDTO } from '../dtos/UserDTO';

export interface AuthenticateUserInput {
  Email: string;
  Password?: string;
  PasswordUser?: string;
}

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(input: AuthenticateUserInput): Promise<UserDTO> {
    const user = await this.userRepo.findByEmail(input.Email);
    if (!user) {
      throw new InvalidCredentialsException('El email o la contraseña no coinciden');
    }

    const plainPassword = input.Password || input.PasswordUser;
    if (!plainPassword) {
      throw new InvalidCredentialsException('El email o la contraseña no coinciden');
    }

    const isMatch = await this.passwordHasher.compare(plainPassword, user.Password);
    if (!isMatch) {
      throw new InvalidCredentialsException('El email o la contraseña no coinciden');
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
