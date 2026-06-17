import { Sequelize } from 'sequelize';
import db from '../../../database/models/db';
import { SequelizeRememberTokenRepository } from '../SequelizeRememberTokenRepository';
import { RememberToken } from '../../../domain/entities/RememberToken';

let isSqliteAvailable = false;
let sequelize: Sequelize | null = null;
let sqliteUserModel: any = null;
let sqliteRememberTokenModel: any = null;

try {
  require('sqlite3');
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  const UserDefine = require('../../../database/models/User');
  const RememberTokenDefine = require('../../../database/models/RememberToken');
  
  sqliteUserModel = UserDefine(sequelize);
  sqliteRememberTokenModel = RememberTokenDefine(sequelize);

  sqliteUserModel.hasMany(sqliteRememberTokenModel, { foreignKey: 'IDUser' });
  sqliteRememberTokenModel.belongsTo(sqliteUserModel, { foreignKey: 'IDUser' });

  isSqliteAvailable = true;
} catch (e) {
  isSqliteAvailable = false;
}

describe('SequelizeRememberTokenRepository Integration Tests', () => {
  let repository: SequelizeRememberTokenRepository;
  const originalRememberToken = db.RememberToken;

  beforeEach(async () => {
    repository = new SequelizeRememberTokenRepository();
    if (isSqliteAvailable && sequelize && sqliteRememberTokenModel) {
      (db as any).RememberToken = sqliteRememberTokenModel;
      await sequelize.sync({ force: true });
    } else {
      (db as any).RememberToken = {
        create: jest.fn(),
        findOne: jest.fn(),
        destroy: jest.fn(),
      } as any;
    }
  });

  afterAll(() => {
    (db as any).RememberToken = originalRememberToken;
  });

  describe('create', () => {
    it('should create and store remember token', async () => {
      if (isSqliteAvailable && sqliteUserModel) {
        const user = await sqliteUserModel.create({
          FirstName: 'Test',
          LastName: 'User',
          Email: 'test@example.com',
          PasswordUser: 'hash',
        });

        const expiry = new Date(Date.now() + 3600 * 1000);
        const token = new RememberToken(0, 'hashed_token_string', user.IDUser, expiry);

        const created = await repository.create(token);
        expect(created.IDRememberToken).toBeGreaterThan(0);
        expect(created.TokenHash).toBe('hashed_token_string');
        expect(created.IDUser).toBe(user.IDUser);
        expect(created.ExpiryDate.getTime()).toBeCloseTo(expiry.getTime(), -2);
      } else {
        const mockInstance = {
          id: 10,
          TokenHash: 'hashed_token_string',
          IDUser: 5,
          ExpiresAt: new Date(),
        };
        jest.mocked(db.RememberToken.create).mockResolvedValue(mockInstance as any);

        const expiry = new Date();
        const token = new RememberToken(0, 'hashed_token_string', 5, expiry);

        const created = await repository.create(token);
        expect(created.IDRememberToken).toBe(10);
        expect(created.TokenHash).toBe('hashed_token_string');
        expect(db.RememberToken.create).toHaveBeenCalled();
      }
    });
  });

  describe('findByHash', () => {
    it('should retrieve a token by hash if it exists', async () => {
      if (isSqliteAvailable && sqliteUserModel) {
        const user = await sqliteUserModel.create({
          FirstName: 'Test',
          LastName: 'User',
          Email: 'test@example.com',
          PasswordUser: 'hash',
        });

        const expiry = new Date(Date.now() + 3600 * 1000);
        await sqliteRememberTokenModel.create({
          IDUser: user.IDUser,
          TokenHash: 'my_unique_hash',
          ExpiresAt: expiry,
        });

        const found = await repository.findByHash('my_unique_hash');
        expect(found).not.toBeNull();
        expect(found?.TokenHash).toBe('my_unique_hash');
        expect(found?.IDUser).toBe(user.IDUser);
      } else {
        const mockInstance = {
          id: 11,
          TokenHash: 'my_unique_hash',
          IDUser: 6,
          ExpiresAt: new Date(),
        };
        jest.mocked(db.RememberToken.findOne).mockResolvedValue(mockInstance as any);

        const found = await repository.findByHash('my_unique_hash');
        expect(found).not.toBeNull();
        expect(found?.TokenHash).toBe('my_unique_hash');
        expect(db.RememberToken.findOne).toHaveBeenCalledWith({ where: { TokenHash: 'my_unique_hash' } });
      }
    });

    it('should return null if hash does not exist', async () => {
      if (isSqliteAvailable) {
        const found = await repository.findByHash('nonexistent');
        expect(found).toBeNull();
      } else {
        jest.mocked(db.RememberToken.findOne).mockResolvedValue(null);
        const found = await repository.findByHash('nonexistent');
        expect(found).toBeNull();
      }
    });
  });

  describe('deleteByHash', () => {
    it('should delete token and return true if deletion occurred', async () => {
      if (isSqliteAvailable && sqliteUserModel) {
        const user = await sqliteUserModel.create({
          FirstName: 'Test',
          LastName: 'User',
          Email: 'test@example.com',
          PasswordUser: 'hash',
        });

        const expiry = new Date(Date.now() + 3600 * 1000);
        await sqliteRememberTokenModel.create({
          IDUser: user.IDUser,
          TokenHash: 'to_delete',
          ExpiresAt: expiry,
        });

        const deleted = await repository.deleteByHash('to_delete');
        expect(deleted).toBe(true);

        const found = await repository.findByHash('to_delete');
        expect(found).toBeNull();
      } else {
        jest.mocked(db.RememberToken.destroy).mockResolvedValue(1);

        const deleted = await repository.deleteByHash('to_delete');
        expect(deleted).toBe(true);
        expect(db.RememberToken.destroy).toHaveBeenCalledWith({ where: { TokenHash: 'to_delete' } });
      }
    });

    it('should return false if token was not deleted', async () => {
      if (isSqliteAvailable) {
        const deleted = await repository.deleteByHash('nonexistent');
        expect(deleted).toBe(false);
      } else {
        jest.mocked(db.RememberToken.destroy).mockResolvedValue(0);

        const deleted = await repository.deleteByHash('nonexistent');
        expect(deleted).toBe(false);
      }
    });
  });
});
