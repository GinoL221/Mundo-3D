import { ListUsersUseCase } from '../use-cases/ListUsersUseCase';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { User } from '../../domain/entities/User';

describe('ListUsersUseCase', () => {
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let useCase: ListUsersUseCase;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

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
      IDUser: 1,
      FirstName: 'Alice',
      LastName: 'Smith',
      Email: 'alice@example.com',
      Image: 'alice.jpg',
      IDRole: 2,
      Category: 'Admin',
    });
    expect(result[1]).toEqual({
      IDUser: 2,
      FirstName: 'Bob',
      LastName: 'Jones',
      Email: 'bob@example.com',
      Image: null,
      IDRole: 3,
      Category: 'User',
    });
    expect(mockUserRepo.findAll).toHaveBeenCalledTimes(1);
  });
});
