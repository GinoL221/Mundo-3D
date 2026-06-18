import { RegisterUserUseCase, RegisterUserInput } from '../use-cases/RegisterUserUseCase';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { UserAlreadyExistsException } from '../../domain/exceptions/UserAlreadyExistsException';
import { User } from '../../domain/entities/User';

describe('RegisterUserUseCase', () => {
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockPasswordHasher: jest.Mocked<IPasswordHasher>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    mockPasswordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as unknown as jest.Mocked<IPasswordHasher>;

    useCase = new RegisterUserUseCase(mockUserRepo, mockPasswordHasher);
  });

  it('should successfully register a user when email is not taken, defaulting to the standard role', async () => {
    const input: RegisterUserInput = {
      FirstName: 'John',
      LastName: 'Doe',
      Email: 'john.doe@example.com',
      Password: 'plainPassword123',
      Image: 'avatar.jpg',
    };

    const expectedHashedPassword = 'hashedPassword123';
    const createdUser = new User(
      42,
      input.FirstName,
      input.LastName,
      input.Email,
      expectedHashedPassword,
      input.Image,
      2,
      'User'
    );

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue(expectedHashedPassword);
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute(input);

    expect(result).toEqual({
      IDUser: 42,
      FirstName: 'John',
      LastName: 'Doe',
      Email: 'john.doe@example.com',
      Image: 'avatar.jpg',
      IDRole: 2,
      Category: 'User',
    });

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('john.doe@example.com');
    expect(mockPasswordHasher.hash).toHaveBeenCalledWith('plainPassword123');
    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        FirstName: 'John',
        LastName: 'Doe',
        Email: 'john.doe@example.com',
        Password: expectedHashedPassword,
        Image: 'avatar.jpg',
        IDRole: 2,
        Category: 'User',
      })
    );
  });

  it('should ignore an attacker-supplied administrative role and force the default standard role', async () => {
    const input = {
      FirstName: 'Evil',
      LastName: 'Hacker',
      Email: 'evil.hacker@example.com',
      Password: 'plainPassword123',
      Image: 'avatar.jpg',
      IDRole: 1,
      Category: 'Admin',
    } as RegisterUserInput;

    const expectedHashedPassword = 'hashedPassword123';
    const createdUser = new User(
      99,
      input.FirstName,
      input.LastName,
      input.Email,
      expectedHashedPassword,
      input.Image,
      2,
      'User'
    );

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue(expectedHashedPassword);
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute(input);

    expect(result.IDRole).toBe(2);
    expect(result.Category).toBe('User');

    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        IDRole: 2,
        Category: 'User',
      })
    );
  });

  it('should successfully register a user when input uses PasswordUser', async () => {
    const input: RegisterUserInput = {
      FirstName: 'John',
      LastName: 'Doe',
      Email: 'john.doe@example.com',
      PasswordUser: 'plainPassword123',
      Image: 'avatar.jpg',
    };

    const expectedHashedPassword = 'hashedPassword123';
    const createdUser = new User(
      42,
      input.FirstName,
      input.LastName,
      input.Email,
      expectedHashedPassword,
      input.Image,
      null,
      null
    );

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue(expectedHashedPassword);
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute(input);

    expect(result.IDUser).toBe(42);
    expect(mockPasswordHasher.hash).toHaveBeenCalledWith('plainPassword123');
  });

  it('should throw UserAlreadyExistsException if email is already taken', async () => {
    const input: RegisterUserInput = {
      FirstName: 'Jane',
      LastName: 'Doe',
      Email: 'jane.doe@example.com',
      Password: 'password123',
      Image: null,
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
      FirstName: 'Jane',
      LastName: 'Doe',
      Email: 'jane.doe@example.com',
      Image: null,
    };

    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow('Password is required');
  });
});
