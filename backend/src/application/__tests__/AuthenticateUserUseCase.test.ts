import { AuthenticateUserUseCase, AuthenticateUserInput } from '../use-cases/AuthenticateUserUseCase';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { PasswordHasherPort } from '../../domain/ports/PasswordHasherPort';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';
import { User } from '../../domain/entities/User';

describe('AuthenticateUserUseCase', () => {
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockPasswordHasher: jest.Mocked<PasswordHasherPort>;
  let useCase: AuthenticateUserUseCase;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UserRepositoryPort>;

    mockPasswordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
      compareAgainstDecoy: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherPort>;

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

  // MEDIUM-3 of the auth security review: returning early on a repository miss
  // skipped bcrypt entirely, so an unknown email answered ~90ms faster than a
  // known one. The generic error message does not hide that — the clock
  // answers "does this account exist?" regardless of what the body says.
  it('spends a decoy comparison when the email is unknown, so a miss costs what a hit costs', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'notfound@example.com', password: 'password' })
    ).rejects.toThrow(InvalidCredentialsException);

    expect(mockPasswordHasher.compareAgainstDecoy).toHaveBeenCalledWith('password');
  });

  it('skips the decoy when no password was supplied, so that path stays symmetric too', async () => {
    // A caller who sends no password already knows they sent none, so there is
    // nothing to hide from them. Burning the decoy here would invert the leak:
    // an unknown email would answer SLOWER than a known one, which returns
    // early on the same input.
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute({ email: 'notfound@example.com' })).rejects.toThrow(
      InvalidCredentialsException
    );

    expect(mockPasswordHasher.compareAgainstDecoy).not.toHaveBeenCalled();
  });

  it('never spends a decoy comparison when the user exists', async () => {
    const existingUser = new User(7, 'Bob', 'Builder', 'test@example.com', 'hashedPassword', null, null, null);
    mockUserRepo.findByEmail.mockResolvedValue(existingUser);
    mockPasswordHasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'wrongPassword' })
    ).rejects.toThrow(InvalidCredentialsException);

    expect(mockPasswordHasher.compare).toHaveBeenCalledWith('wrongPassword', 'hashedPassword');
    expect(mockPasswordHasher.compareAgainstDecoy).not.toHaveBeenCalled();
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
