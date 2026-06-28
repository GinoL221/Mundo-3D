import { IUserRepository } from '../../domain/ports/IUserRepository';
import { UserDTO } from '../dtos/UserDTO';

export class ListUsersUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(): Promise<UserDTO[]> {
    const users = await this.userRepository.findAll();
    return users.map(user => ({
      idUser: user.idUser,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      image: user.image,
      idRole: user.idRole ?? null,
      category: user.category ?? null,
    }));
  }
}
