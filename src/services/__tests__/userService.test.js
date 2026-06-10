const UserService = require('../userService');

// Mock the database models
jest.mock('../../database/models/db', () => ({
  User: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hashSync: jest.fn((password) => `hashed_${password}`),
  compareSync: jest.fn((plain, hash) => plain === 'correct' && hash === 'hashed_correct'),
}));

const { User } = require('../../database/models/db');
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
});
