import { GetUserByIdUseCase } from '../use-cases/GetUserByIdUseCase';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { User } from '../../domain/entities/User';

describe('GetUserByIdUseCase', () => {
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let useCase: GetUserByIdUseCase;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<UserRepositoryPort>;

    useCase = new GetUserByIdUseCase(mockUserRepo);
  });

  it('should throw an error when user is not found', async () => {
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow('User not found');
    expect(mockUserRepo.findById).toHaveBeenCalledWith(999);
  });

  it('should fetch user and map to UserDTO', async () => {
    const user = new User(42, 'John', 'Doe', 'john@example.com', 'pwd', 'john.jpg', 1, 'Admin');
    mockUserRepo.findById.mockResolvedValue(user);

    const result = await useCase.execute(42);

    expect(result).toEqual({
      idUser: 42,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      image: 'john.jpg',
      idRole: 1,
      category: 'Admin',
    });
    expect(mockUserRepo.findById).toHaveBeenCalledWith(42);
  });
});
