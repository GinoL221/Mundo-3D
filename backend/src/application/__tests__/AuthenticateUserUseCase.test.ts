import { AuthenticateUserUseCase, AuthenticateUserInput } from '../use-cases/AuthenticateUserUseCase';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';
import { User } from '../../domain/entities/User';

describe('AuthenticateUserUseCase', () => {
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockPasswordHasher: jest.Mocked<IPasswordHasher>;
  let useCase: AuthenticateUserUseCase;

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

    useCase = new AuthenticateUserUseCase(mockUserRepo, mockPasswordHasher);
  });

  it('should authenticate successfully with correct credentials (using password)', async () => {
    const input: AuthenticateUserInput = {
      email: 'test@example.com',
      password: 'correctPassword',
    };

    const existingUser = new User(
      7,
      'Bob',
      'Builder',
      'test@example.com',
      'hashedPassword',
      'bob.jpg',
      1,
      'Admin'
    );

    mockUserRepo.findByEmail.mockResolvedValue(existingUser);
    mockPasswordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute(input);

    expect(result).toEqual({
      idUser: 7,
      firstName: 'Bob',
      lastName: 'Builder',
      email: 'test@example.com',
      image: 'bob.jpg',
      idRole: 1,
      category: 'Admin',
    });

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
    expect(mockPasswordHasher.compare).toHaveBeenCalledWith('correctPassword', 'hashedPassword');
  });

  it('should authenticate successfully with correct credentials (using passwordUser)', async () => {
    const input: AuthenticateUserInput = {
      email: 'test@example.com',
      passwordUser: 'correctPassword',
    };

    const existingUser = new User(
      7,
      'Bob',
      'Builder',
      'test@example.com',
      'hashedPassword',
      'bob.jpg',
      null,
      null
    );

    mockUserRepo.findByEmail.mockResolvedValue(existingUser);
    mockPasswordHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute(input);

    expect(result.idUser).toBe(7);
    expect(mockPasswordHasher.compare).toHaveBeenCalledWith('correctPassword', 'hashedPassword');
  });

  it('should throw InvalidCredentialsException when email is not found', async () => {
    const input: AuthenticateUserInput = {
      email: 'notfound@example.com',
      password: 'password',
    };

    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(InvalidCredentialsException);
    await expect(useCase.execute(input)).rejects.toThrow('El email o la contraseña no coinciden');

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('notfound@example.com');
    expect(mockPasswordHasher.compare).not.toHaveBeenCalled();
  });

  it('should throw InvalidCredentialsException when password does not match', async () => {
    const input: AuthenticateUserInput = {
      email: 'test@example.com',
      password: 'wrongPassword',
    };

    const existingUser = new User(
      7,
      'Bob',
      'Builder',
      'test@example.com',
      'hashedPassword',
      'bob.jpg',
      null,
      null
    );

    mockUserRepo.findByEmail.mockResolvedValue(existingUser);
    mockPasswordHasher.compare.mockResolvedValue(false);

    await expect(useCase.execute(input)).rejects.toThrow(InvalidCredentialsException);
    await expect(useCase.execute(input)).rejects.toThrow('El email o la contraseña no coinciden');

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
    expect(mockPasswordHasher.compare).toHaveBeenCalledWith('wrongPassword', 'hashedPassword');
  });

  it('should throw InvalidCredentialsException when no password is provided', async () => {
    const input: AuthenticateUserInput = {
      email: 'test@example.com',
    };

    const existingUser = new User(
      7,
      'Bob',
      'Builder',
      'test@example.com',
      'hashedPassword',
      'bob.jpg',
      null,
      null
    );

    mockUserRepo.findByEmail.mockResolvedValue(existingUser);

    await expect(useCase.execute(input)).rejects.toThrow(InvalidCredentialsException);
  });
});
