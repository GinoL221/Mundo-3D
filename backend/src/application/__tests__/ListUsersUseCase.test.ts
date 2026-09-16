import { ListUsersUseCase } from '../use-cases/ListUsersUseCase';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { User } from '../../domain/entities/User';

describe('ListUsersUseCase', () => {
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let useCase: ListUsersUseCase;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<UserRepositoryPort>;

    useCase = new ListUsersUseCase(mockUserRepo);
  });

  it('should return empty list when repository has no users', async () => {
    mockUserRepo.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
    expect(mockUserRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it('should fetch all users and map them to UserDTOs', async () => {
    const users = [
      new User(1, 'Alice', 'Smith', 'alice@example.com', 'password123', 'alice.jpg', 2, 'Admin'),
      new User(2, 'Bob', 'Jones', 'bob@example.com', 'securepwd', null, 3, 'User'),
    ];

    mockUserRepo.findAll.mockResolvedValue(users);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      idUser: 1,
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      image: 'alice.jpg',
      idRole: 2,
      category: 'Admin',
    });
    expect(result[1]).toEqual({
      idUser: 2,
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@example.com',
      image: null,
      idRole: 3,
      category: 'User',
    });
    expect(mockUserRepo.findAll).toHaveBeenCalledTimes(1);
  });
});
