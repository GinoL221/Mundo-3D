import { RegisterUserUseCase, RegisterUserInput } from '../use-cases/RegisterUserUseCase';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { PasswordHasherPort } from '../../domain/ports/PasswordHasherPort';
import { UserAlreadyExistsException } from '../../domain/exceptions/UserAlreadyExistsException';
import { User } from '../../domain/entities/User';
import { EmailConfirmationIssuerPort } from '../../domain/ports/EmailConfirmationIssuerPort';

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
      'User',
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
      }),
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
      'User',
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
      }),
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
      null,
    );

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue(expectedHashedPassword);
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute(input);

    expect(result.idUser).toBe(42);
    expect(mockPasswordHasher.hash).toHaveBeenCalledWith('plainPassword123');
  });

  it('rejects an existing email before hashing, creation, or post-create issuance', async () => {
    const input: RegisterUserInput = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      password: 'password123',
      image: null,
    };
    const issuer: jest.Mocked<EmailConfirmationIssuerPort> = { issueForUser: jest.fn() };
    const existingUser = new User(
      10,
      'Jane',
      'Doe',
      'jane.doe@example.com',
      'alreadyhashed',
      null,
      null,
      null,
    );
    const useCase = new (RegisterUserUseCase as unknown as new (
      userRepo: UserRepositoryPort,
      passwordHasher: PasswordHasherPort,
      issuer: EmailConfirmationIssuerPort,
    ) => RegisterUserUseCase)(mockUserRepo, mockPasswordHasher, issuer);

    mockUserRepo.findByEmail.mockResolvedValue(existingUser);

    await expect(useCase.execute(input)).rejects.toThrow(UserAlreadyExistsException);
    await expect(useCase.execute(input)).rejects.toThrow('Este email ya está registrado');

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('jane.doe@example.com');
    expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
    expect(mockUserRepo.create).not.toHaveBeenCalled();
    expect(issuer.issueForUser).not.toHaveBeenCalled();
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

  it('issues only after user creation and keeps token material out of the created user and DTO', async () => {
    const calls: string[] = [];
    const createdUser = new User(
      44,
      'Mina',
      'Cole',
      'mina@example.com',
      'hashedPassword123',
      'mina.jpg',
      2,
      'User',
      null,
    );
    const issuer: jest.Mocked<EmailConfirmationIssuerPort> = {
      issueForUser: jest.fn().mockImplementation(async () => {
        calls.push('issue');
        return { outcome: 'issued' };
      }),
    };
    const useCase = new (RegisterUserUseCase as unknown as new (
      userRepo: UserRepositoryPort,
      passwordHasher: PasswordHasherPort,
      issuer: EmailConfirmationIssuerPort,
    ) => RegisterUserUseCase)(mockUserRepo, mockPasswordHasher, issuer);

    mockUserRepo.findByEmail.mockImplementation(async () => {
      calls.push('find');
      return null;
    });
    mockPasswordHasher.hash.mockImplementation(async () => {
      calls.push('hash');
      return 'hashedPassword123';
    });
    mockUserRepo.create.mockImplementation(async (user) => {
      calls.push('create');
      expect(JSON.stringify(user)).not.toMatch(
        /opaque-token-sentinel|digest-sentinel|confirm-email/i,
      );
      return createdUser;
    });

    const result = await useCase.execute({
      firstName: 'Mina',
      lastName: 'Cole',
      email: 'mina@example.com',
      password: 'plainPassword123',
      image: 'mina.jpg',
    });

    expect(calls).toEqual(['find', 'hash', 'create', 'issue']);
    expect(result).toEqual({
      idUser: 44,
      firstName: 'Mina',
      lastName: 'Cole',
      email: 'mina@example.com',
      image: 'mina.jpg',
      idRole: 2,
      category: 'User',
    });
    expect(JSON.stringify(result)).not.toMatch(
      /opaque-token-sentinel|digest-sentinel|confirm-email/i,
    );
  });

  it('keeps internal verification state out of the registration DTO', async () => {
    const input: RegisterUserInput = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'plainPassword123',
      image: 'ada.jpg',
    };
    const createdUser = new User(
      43,
      input.firstName,
      input.lastName,
      input.email,
      'hashedPassword123',
      input.image,
      2,
      'User',
      new Date('2026-09-10T12:34:56.000Z'),
    );

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue('hashedPassword123');
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute(input);

    expect(result).toEqual({
      idUser: 43,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      image: 'ada.jpg',
      idRole: 2,
      category: 'User',
    });
    expect(JSON.stringify(result)).not.toMatch(
      /emailVerifiedAt|opaque-token|tokenHash|confirm-email|https?:\/\//i,
    );
  });

  it('keeps the unverified user and registration DTO committed when confirmation token persistence fails', async () => {
    const createdUser = new User(
      51,
      'Grace',
      'Hopper',
      'grace@example.com',
      'hashedPassword123',
      'grace.png',
      2,
      'User',
      null,
    );
    const issuer: jest.Mocked<EmailConfirmationIssuerPort> = {
      issueForUser: jest
        .fn()
        .mockRejectedValue(
          new Error(
            'token-persistence-failed opaque-token-sentinel digest-sentinel https://trusted.example/confirm-email',
          ),
        ),
    };
    const useCase = new (RegisterUserUseCase as unknown as new (
      userRepo: UserRepositoryPort,
      passwordHasher: PasswordHasherPort,
      issuer: EmailConfirmationIssuerPort,
    ) => RegisterUserUseCase)(mockUserRepo, mockPasswordHasher, issuer);

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue('hashedPassword123');
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      password: 'password123',
      image: 'grace.png',
    });

    expect(createdUser.emailVerifiedAt).toBeNull();
    expect(issuer.issueForUser).toHaveBeenCalledWith(51);
    expect(result).toEqual({
      idUser: 51,
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      image: 'grace.png',
      idRole: 2,
      category: 'User',
    });
    expect(JSON.stringify(result)).not.toMatch(/opaque-token-sentinel|confirm-email|https?:\/\//i);
  });

  it('keeps the unverified user and registration DTO committed when SMTP submission fails', async () => {
    const createdUser = new User(
      52,
      'Lin',
      'Tao',
      'lin@example.com',
      'hashedPassword123',
      'lin.png',
      2,
      'User',
      null,
    );
    const issuer: jest.Mocked<EmailConfirmationIssuerPort> = {
      issueForUser: jest
        .fn()
        .mockRejectedValue(
          new Error(
            'smtp-failed opaque-token-sentinel digest-sentinel https://trusted.example/confirm-email',
          ),
        ),
    };
    const useCase = new (RegisterUserUseCase as unknown as new (
      userRepo: UserRepositoryPort,
      passwordHasher: PasswordHasherPort,
      issuer: EmailConfirmationIssuerPort,
    ) => RegisterUserUseCase)(mockUserRepo, mockPasswordHasher, issuer);

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue('hashedPassword123');
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute({
      firstName: 'Lin',
      lastName: 'Tao',
      email: 'lin@example.com',
      password: 'password123',
      image: 'lin.png',
    });

    expect(createdUser.emailVerifiedAt).toBeNull();
    expect(issuer.issueForUser).toHaveBeenCalledWith(52);
    expect(result).toMatchObject({ idUser: 52, email: 'lin@example.com' });
    expect(JSON.stringify(result)).not.toMatch(/smtp|token|confirm-email|https?:\/\//i);
  });

  it('does not issue a token or mail intent when user creation rejects', async () => {
    const issuer: jest.Mocked<EmailConfirmationIssuerPort> = {
      issueForUser: jest.fn(),
    };
    const useCase = new (RegisterUserUseCase as unknown as new (
      userRepo: UserRepositoryPort,
      passwordHasher: PasswordHasherPort,
      issuer: EmailConfirmationIssuerPort,
    ) => RegisterUserUseCase)(mockUserRepo, mockPasswordHasher, issuer);

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue('hashedPassword123');
    mockUserRepo.create.mockRejectedValue(
      new UserAlreadyExistsException('Este email ya está registrado'),
    );

    await expect(
      useCase.execute({
        firstName: 'Race',
        lastName: 'Loser',
        email: 'race@example.com',
        password: 'password123',
        image: 'loser.png',
      }),
    ).rejects.toThrow('Este email ya está registrado');

    expect(issuer.issueForUser).not.toHaveBeenCalled();
  });
});
