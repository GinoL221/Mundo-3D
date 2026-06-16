import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { UserAlreadyExistsException } from '../../domain/exceptions/UserAlreadyExistsException';
import { UserDTO } from '../dtos/UserDTO';
import { User } from '../../domain/entities/User';

export interface RegisterUserInput {
  FirstName: string;
  LastName: string;
  Email: string;
  Password?: string;
  PasswordUser?: string;
  Image: string | null;
  IDRole?: number | null;
  Category?: string | null;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(input: RegisterUserInput): Promise<UserDTO> {
    const existingUser = await this.userRepo.findByEmail(input.Email);
    if (existingUser) {
      throw new UserAlreadyExistsException('Este email ya está registrado');
    }

    const plainPassword = input.Password || input.PasswordUser;
    if (!plainPassword) {
      throw new Error('Password is required');
    }

    const hashedPassword = await this.passwordHasher.hash(plainPassword);

    const userEntity = new User(
      0, // IDUser is ignored/overwritten by the repository upon creation
      input.FirstName,
      input.LastName,
      input.Email,
      hashedPassword,
      input.Image,
      input.IDRole,
      input.Category
    );

    const createdUser = await this.userRepo.create(userEntity);

    return {
      IDUser: createdUser.IDUser,
      FirstName: createdUser.FirstName,
      LastName: createdUser.LastName,
      Email: createdUser.Email,
      Image: createdUser.Image,
      IDRole: createdUser.IDRole,
      Category: createdUser.Category,
    };
  }
}
