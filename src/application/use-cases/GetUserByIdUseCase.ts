import { IUserRepository } from '../../domain/ports/IUserRepository';
import { UserDTO } from '../dtos/UserDTO';

export class GetUserByIdUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(id: number): Promise<UserDTO> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      IDUser: user.IDUser,
      FirstName: user.FirstName,
      LastName: user.LastName,
      Email: user.Email,
      Image: user.Image,
      IDRole: user.IDRole ?? null,
      Category: user.Category ?? null,
    };
  }
}
