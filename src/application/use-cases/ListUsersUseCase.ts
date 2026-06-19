import { IUserRepository } from '../../domain/ports/IUserRepository';
import { UserDTO } from '../dtos/UserDTO';

export class ListUsersUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(): Promise<UserDTO[]> {
    const users = await this.userRepository.findAll();
    return users.map(user => ({
      IDUser: user.IDUser,
      FirstName: user.FirstName,
      LastName: user.LastName,
      Email: user.Email,
      Image: user.Image,
      IDRole: user.IDRole ?? null,
      Category: user.Category ?? null,
    }));
  }
}
