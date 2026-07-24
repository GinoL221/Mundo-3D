import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { UserDTO } from '../dtos/UserDTO';

export class GetUserByIdUseCase {
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute(id: number): Promise<UserDTO> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      idUser: user.idUser,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      image: user.image,
      idRole: user.idRole ?? null,
      category: user.category ?? null,
    };
  }
}
