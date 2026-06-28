import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { UserAlreadyExistsException } from '../../domain/exceptions/UserAlreadyExistsException';
import { UserDTO } from '../dtos/UserDTO';
import { User } from '../../domain/entities/User';

export interface RegisterUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  passwordUser?: string;
  image: string | null;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(input: RegisterUserInput): Promise<UserDTO> {
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new UserAlreadyExistsException('Este email ya está registrado');
    }

    const plainPassword = input.password || input.passwordUser;
    if (!plainPassword) {
      throw new Error('Password is required');
    }

    const hashedPassword = await this.passwordHasher.hash(plainPassword);

    // Public self-registration must never trust caller-supplied role data.
    // Always force the standard user role, regardless of what the input contains.
    const userEntity = new User(
      0, // idUser is ignored/overwritten by the repository upon creation
      input.firstName,
      input.lastName,
      input.email,
      hashedPassword,
      input.image,
      2,
      'User'
    );

    const createdUser = await this.userRepo.create(userEntity);

    return {
      idUser: createdUser.idUser,
      firstName: createdUser.firstName,
      lastName: createdUser.lastName,
      email: createdUser.email,
      image: createdUser.image,
      idRole: createdUser.idRole,
      category: createdUser.category,
    };
  }
}
