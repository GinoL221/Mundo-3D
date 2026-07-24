import { RegisterUserUseCase, RegisterUserInput } from '../use-cases/RegisterUserUseCase';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { PasswordHasherPort } from '../../domain/ports/PasswordHasherPort';
import { UserAlreadyExistsException } from '../../domain/exceptions/UserAlreadyExistsException';
import { User } from '../../domain/entities/User';

describe('RegisterUserUseCase', () => {
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockPasswordHasher: jest.Mocked<PasswordHasherPort>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UserRepositoryPort>;

    mockPasswordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherPort>;

    useCase = new RegisterUserUseCase(mockUserRepo, mockPasswordHasher);
  });

  it('should successfully register a user when email is not taken, defaulting to the standard role', async () => {
    const input: RegisterUserInput = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'plainPassword123',
      image: 'avatar.jpg',
    };

    const expectedHashedPassword = 'hashedPassword123';
    const createdUser = new User(
      42,
      input.firstName,
      input.lastName,
      input.email,
      expectedHashedPassword,
      input.image,
      2,
      'User'
    );

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue(expectedHashedPassword);
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute(input);

    expect(result).toEqual({
      idUser: 42,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      image: 'avatar.jpg',
      idRole: 2,
      category: 'User',
    });

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('john.doe@example.com');
    expect(mockPasswordHasher.hash).toHaveBeenCalledWith('plainPassword123');
    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: expectedHashedPassword,
        image: 'avatar.jpg',
        idRole: 2,
        category: 'User',
      })
    );
  });

  it('should ignore an attacker-supplied administrative role and force the default standard role', async () => {
    const input = {
      firstName: 'Evil',
      lastName: 'Hacker',
      email: 'evil.hacker@example.com',
      password: 'plainPassword123',
      image: 'avatar.jpg',
      idRole: 1,
      category: 'Admin',
    } as RegisterUserInput;

    const expectedHashedPassword = 'hashedPassword123';
    const createdUser = new User(
      99,
      input.firstName,
      input.lastName,
      input.email,
      expectedHashedPassword,
      input.image,
      2,
      'User'
    );

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue(expectedHashedPassword);
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute(input);

    expect(result.idRole).toBe(2);
    expect(result.category).toBe('User');

    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idRole: 2,
        category: 'User',
      })
    );
  });

  it('should successfully register a user when input uses passwordUser', async () => {
    const input: RegisterUserInput = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      passwordUser: 'plainPassword123',
      image: 'avatar.jpg',
    };

    const expectedHashedPassword = 'hashedPassword123';
    const createdUser = new User(
      42,
      input.firstName,
      input.lastName,
      input.email,
      expectedHashedPassword,
      input.image,
      null,
      null
    );

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue(expectedHashedPassword);
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute(input);

    expect(result.idUser).toBe(42);
    expect(mockPasswordHasher.hash).toHaveBeenCalledWith('plainPassword123');
  });

  it('should throw UserAlreadyExistsException if email is already taken', async () => {
    const input: RegisterUserInput = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      password: 'password123',
      image: null,
    };

    const existingUser = new User(
      10,
      'Jane',
      'Doe',
      'jane.doe@example.com',
      'alreadyhashed',
      null,
      null,
      null
    );

    mockUserRepo.findByEmail.mockResolvedValue(existingUser);

    await expect(useCase.execute(input)).rejects.toThrow(UserAlreadyExistsException);
    await expect(useCase.execute(input)).rejects.toThrow('Este email ya está registrado');

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('jane.doe@example.com');
    expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });

  it('should throw an error if no password is provided', async () => {
    const input: RegisterUserInput = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      image: null,
    };

    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow('Password is required');
  });
});
