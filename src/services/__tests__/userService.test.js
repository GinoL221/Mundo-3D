const UserService = require('../userService');

// Mock the database models
jest.mock('../../database/models/db', () => ({
  User: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  RememberToken: {
    create: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hashSync: jest.fn((password) => `hashed_${password}`),
  compareSync: jest.fn((plain, hash) => plain === 'correct' && hash === 'hashed_correct'),
}));

const { User, RememberToken } = require('../../database/models/db');
const bcryptjs = require('bcryptjs');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all users excluding password', async () => {
      const mockUsers = [
        { IDUser: 1, FirstName: 'John', Email: 'john@test.com' },
        { IDUser: 2, FirstName: 'Jane', Email: 'jane@test.com' },
      ];
      User.findAll.mockResolvedValue(mockUsers);

      const result = await UserService.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockUsers);
      expect(User.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: { exclude: ['PasswordUser'] },
        }),
      );
    });
  });

  describe('findByEmail', () => {
    it('excludes password by default', async () => {
      const mockUser = {
        IDUser: 1,
        FirstName: 'John',
        Email: 'john@test.com',
      };
      User.findOne.mockResolvedValue(mockUser);

      const result = await UserService.findByEmail('john@test.com');

      expect(result).toEqual(mockUser);
      expect(User.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { Email: 'john@test.com' },
          attributes: { exclude: ['PasswordUser'] },
        }),
      );
    });

    it('includes password when includePassword is true', async () => {
      const mockUser = {
        IDUser: 1,
        FirstName: 'John',
        Email: 'john@test.com',
        PasswordUser: 'hashed_secret',
      };
      User.findOne.mockResolvedValue(mockUser);

      const result = await UserService.findByEmail('john@test.com', {
        includePassword: true,
      });

      expect(result).toEqual(mockUser);
      expect(User.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { Email: 'john@test.com' },
        }),
      );
      // Should NOT have attributes exclude when includePassword is true
      const callArgs = User.findOne.mock.calls[0][0];
      expect(callArgs.attributes).toBeUndefined();
    });

    it('returns null when user not found', async () => {
      User.findOne.mockResolvedValue(null);

      const result = await UserService.findByEmail('nonexistent@test.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a new user with hashed password', async () => {
      const inputData = {
        FirstName: 'New',
        LastName: 'User',
        Email: 'new@test.com',
        PasswordUser: 'secret123',
      };
      const createdUser = { IDUser: 3, ...inputData };
      User.create.mockResolvedValue(createdUser);

      const result = await UserService.create(inputData);

      expect(result).toEqual(createdUser);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          FirstName: 'New',
          PasswordUser: 'hashed_secret123',
        }),
      );
    });
  });

  describe('remove', () => {
    it('returns true when user is deleted', async () => {
      const mockUser = {
        IDUser: 1,
        destroy: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(mockUser);

      const result = await UserService.remove(1);

      expect(result).toBe(true);
      expect(mockUser.destroy).toHaveBeenCalled();
    });

    it('returns false when user not found', async () => {
      User.findByPk.mockResolvedValue(null);

      const result = await UserService.remove(999);

      expect(result).toBe(false);
    });
  });

  describe('verifyPassword', () => {
    it('returns true when password matches hash', () => {
      bcryptjs.compareSync.mockReturnValue(true);

      const result = UserService.verifyPassword('correct', 'hashed_correct');

      expect(result).toBe(true);
      expect(bcryptjs.compareSync).toHaveBeenCalledWith('correct', 'hashed_correct');
    });

    it('returns false when password does not match hash', () => {
      bcryptjs.compareSync.mockReturnValue(false);

      const result = UserService.verifyPassword('wrong', 'hashed_correct');

      expect(result).toBe(false);
      expect(bcryptjs.compareSync).toHaveBeenCalledWith('wrong', 'hashed_correct');
    });
  });

  describe('createRememberToken', () => {
    it('hashes plainToken and creates a RememberToken in the database', async () => {
      const mockToken = { id: 1, IDUser: 42, TokenHash: 'hashed_token_value', ExpiresAt: new Date() };
      RememberToken.create.mockResolvedValue(mockToken);

      const result = await UserService.createRememberToken(42, 'plain_token_123', 3600);

      expect(result).toEqual(mockToken);
      expect(RememberToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          IDUser: 42,
          TokenHash: expect.any(String),
          ExpiresAt: expect.any(Date),
        })
      );
      // Verify hashing algorithm (SHA-256)
      const crypto = require('crypto');
      const expectedHash = crypto.createHash('sha256').update('plain_token_123').digest('hex');
      expect(RememberToken.create.mock.calls[0][0].TokenHash).toBe(expectedHash);
    });
  });

  describe('verifyRememberToken', () => {
    it('returns User when token is valid and not expired', async () => {
      const mockToken = {
        id: 1,
        IDUser: 42,
        TokenHash: 'hashed_token_value',
        ExpiresAt: new Date(Date.now() + 60000), // in the future
      };
      const mockUser = { IDUser: 42, FirstName: 'John', Email: 'john@test.com' };
      RememberToken.findOne.mockResolvedValue(mockToken);
      User.findByPk.mockResolvedValue(mockUser);

      const result = await UserService.verifyRememberToken('plain_token_123');

      expect(result).toEqual(mockUser);
      expect(RememberToken.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { TokenHash: expect.any(String) },
        })
      );
      expect(User.findByPk).toHaveBeenCalledWith(42, {
        attributes: { exclude: ['PasswordUser'] },
      });
    });

    it('destroys token and returns null when token is expired', async () => {
      const mockDestroy = jest.fn().mockResolvedValue(true);
      const mockToken = {
        id: 1,
        IDUser: 42,
        TokenHash: 'hashed_token_value',
        ExpiresAt: new Date(Date.now() - 60000), // in the past
        destroy: mockDestroy,
      };
      RememberToken.findOne.mockResolvedValue(mockToken);

      const result = await UserService.verifyRememberToken('plain_token_123');

      expect(result).toBeNull();
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('returns null when token is not found in database', async () => {
      RememberToken.findOne.mockResolvedValue(null);

      const result = await UserService.verifyRememberToken('nonexistent_token');

      expect(result).toBeNull();
    });
  });

  describe('deleteRememberToken', () => {
    it('deletes remember token by hash', async () => {
      RememberToken.destroy = jest.fn().mockResolvedValue(1);

      const result = await UserService.deleteRememberToken('plain_token_123');

      expect(result).toBe(1);
      expect(RememberToken.destroy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { TokenHash: expect.any(String) },
        })
      );
      // Verify SHA-256 hashing
      const crypto = require('crypto');
      const expectedHash = crypto.createHash('sha256').update('plain_token_123').digest('hex');
      expect(RememberToken.destroy.mock.calls[0][0].where.TokenHash).toBe(expectedHash);
    });
  });
});
