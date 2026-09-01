import { Sequelize, QueryTypes } from 'sequelize';
import db from '../../../database/models/db';
import { SequelizeRememberTokenRepository } from '../SequelizeRememberTokenRepository';
import { RememberToken } from '../../../domain/entities/RememberToken';
import { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';

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

  sqliteUserModel.hasMany(sqliteRememberTokenModel, { foreignKey: 'idUser' });
  sqliteRememberTokenModel.belongsTo(sqliteUserModel, { foreignKey: 'idUser' });

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
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          passwordUser: 'hash',
        });

        const expiry = new Date(Date.now() + 3600 * 1000);
        const token = new RememberToken(0, 'hashed_token_string', user.idUser, expiry);

        const created = await repository.create(token);
        expect(created.idRememberToken).toBeGreaterThan(0);
        expect(created.tokenHash).toBe('hashed_token_string');
        expect(created.idUser).toBe(user.idUser);
        expect(created.expiryDate.getTime()).toBeCloseTo(expiry.getTime(), -2);
      } else {
        const mockInstance = {
          idRememberToken: 10,
          tokenHash: 'hashed_token_string',
          idUser: 5,
          expiryDate: new Date(),
          createdAt: new Date(),
        };
        jest.mocked(db.RememberToken.create).mockResolvedValue(mockInstance as any);

        const expiry = new Date();
        const token = new RememberToken(0, 'hashed_token_string', 5, expiry);

        const created = await repository.create(token);
        expect(created.idRememberToken).toBe(10);
        expect(created.tokenHash).toBe('hashed_token_string');
        expect(db.RememberToken.create).toHaveBeenCalled();
      }
    });

    it('should create and store remember token with default createdAt if not specified', async () => {
      if (isSqliteAvailable && sqliteUserModel) {
        const user = await sqliteUserModel.create({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          passwordUser: 'hash',
        });

        const expiry = new Date(Date.now() + 3600 * 1000);
        // Do not provide createdAt or set to null
        const token = new RememberToken(0, 'hashed_token_string_no_created', user.idUser, expiry);

        const created = await repository.create(token);
        expect(created.createdAt).toBeInstanceOf(Date);
      } else {
        const mockInstance = {
          idRememberToken: 12,
          tokenHash: 'hashed_token_string_no_created',
          idUser: 5,
          expiryDate: new Date(),
          createdAt: null,
        };
        jest.mocked(db.RememberToken.create).mockResolvedValue(mockInstance as any);

        const expiry = new Date();
        const token = new RememberToken(0, 'hashed_token_string_no_created', 5, expiry);

        const created = await repository.create(token);
        expect(created.createdAt).toBeNull();
      }
    });
  });

  describe('findByHash', () => {
    it('should retrieve a token by hash if it exists', async () => {
      if (isSqliteAvailable && sqliteUserModel) {
        const user = await sqliteUserModel.create({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          passwordUser: 'hash',
        });

        const expiry = new Date(Date.now() + 3600 * 1000);
        await sqliteRememberTokenModel.create({
          idUser: user.idUser,
          tokenHash: 'my_unique_hash',
          expiryDate: expiry,
          createdAt: new Date(),
        });

        const found = await repository.findByHash('my_unique_hash');
        expect(found).not.toBeNull();
        expect(found?.tokenHash).toBe('my_unique_hash');
        expect(found?.idUser).toBe(user.idUser);
      } else {
        const mockInstance = {
          idRememberToken: 11,
          tokenHash: 'my_unique_hash',
          idUser: 6,
          expiryDate: new Date(),
          createdAt: new Date(),
        };
        jest.mocked(db.RememberToken.findOne).mockResolvedValue(mockInstance as any);

        const found = await repository.findByHash('my_unique_hash');
        expect(found).not.toBeNull();
        expect(found?.tokenHash).toBe('my_unique_hash');
        expect(db.RememberToken.findOne).toHaveBeenCalledWith({ where: { tokenHash: 'my_unique_hash' } });
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

    it('should retrieve a token and map null createdAt if it is null in the database', async () => {
      if (isSqliteAvailable && sqliteUserModel) {
        const user = await sqliteUserModel.create({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          passwordUser: 'hash',
        });

        const expiry = new Date(Date.now() + 3600 * 1000);
        await sqliteRememberTokenModel.create({
          idUser: user.idUser,
          tokenHash: 'my_null_created_hash',
          expiryDate: expiry,
          createdAt: null,
        });

        const found = await repository.findByHash('my_null_created_hash');
        expect(found).not.toBeNull();
        expect(found?.createdAt).toBeNull();
      } else {
        const mockInstance = {
          idRememberToken: 13,
          tokenHash: 'my_null_created_hash',
          idUser: 6,
          expiryDate: new Date(),
          createdAt: null,
        };
        jest.mocked(db.RememberToken.findOne).mockResolvedValue(mockInstance as any);

        const found = await repository.findByHash('my_null_created_hash');
        expect(found).not.toBeNull();
        expect(found?.createdAt).toBeNull();
      }
    });
  });

  describe('deleteByHash', () => {
    it('should delete token and return true if deletion occurred', async () => {
      if (isSqliteAvailable && sqliteUserModel) {
        const user = await sqliteUserModel.create({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          passwordUser: 'hash',
        });

        const expiry = new Date(Date.now() + 3600 * 1000);
        await sqliteRememberTokenModel.create({
          idUser: user.idUser,
          tokenHash: 'to_delete',
          expiryDate: expiry,
          createdAt: new Date(),
        });

        const deleted = await repository.deleteByHash('to_delete');
        expect(deleted).toBe(true);

        const found = await repository.findByHash('to_delete');
        expect(found).toBeNull();
      } else {
        jest.mocked(db.RememberToken.destroy).mockResolvedValue(1);

        const deleted = await repository.deleteByHash('to_delete');
        expect(deleted).toBe(true);
        expect(db.RememberToken.destroy).toHaveBeenCalledWith({ where: { tokenHash: 'to_delete' } });
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

  // Rotation operations (HIGH-1 PR1, design.md D1/D2/D7). Always fully
  // mocked (not the sqlite-fallback dual-mode above) — these methods are
  // about proving the exact SQL/args shape of the tx-aware conditional
  // UPDATE, matching `SequelizeProductRepository.test.ts`'s `adjustStock`
  // precedent. `db.sequelize.query` is overloaded per QueryTypes in the real
  // Sequelize typings, awkward for `jest.mocked` — cast to a plain jest.Mock.
  describe('rotation operations — mocked', () => {
    const fakeTx = {} as TransactionContext;

    beforeEach(() => {
      (db as any).RememberToken = {
        create: jest.fn(),
        findOne: jest.fn(),
        destroy: jest.fn(),
        update: jest.fn(),
      };
      jest.spyOn(db.sequelize, 'query').mockReset();
    });

    describe('claimRotation', () => {
      it('claims the row with a conditional UPDATE and returns true when exactly one row is affected', async () => {
        const mockQuery = db.sequelize.query as unknown as jest.Mock;
        mockQuery.mockResolvedValueOnce([undefined, 1]);

        const claimed = await repository.claimRotation({
          presentedHash: 'current-hash',
          successorHash: 'new-hash',
          tx: fakeTx,
        });

        expect(claimed).toBe(true);
        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringMatching(
            /UPDATE.*RememberToken.*SET.*superseded_at.*successor_hash.*WHERE.*token_hash.*superseded_at.*IS NULL.*revoked_at.*IS NULL.*expiry_date/is
          ),
          expect.objectContaining({
            replacements: { presentedHash: 'current-hash', successorHash: 'new-hash' },
            type: QueryTypes.UPDATE,
            transaction: fakeTx,
          })
        );
      });

      it('returns false (lost the race) when the conditional UPDATE affects zero rows', async () => {
        const mockQuery = db.sequelize.query as unknown as jest.Mock;
        mockQuery.mockResolvedValueOnce([undefined, 0]);

        const claimed = await repository.claimRotation({
          presentedHash: 'stale-hash',
          successorHash: 'new-hash',
          tx: fakeTx,
        });

        expect(claimed).toBe(false);
      });
    });

    describe('insertSuccessor', () => {
      it('creates the successor row within the transaction, inheriting family and expiry', async () => {
        const expiry = new Date('2026-10-01T00:00:00Z');
        const createdInstance = {
          idRememberToken: 42,
          tokenHash: 'new-hash',
          idUser: 7,
          expiryDate: expiry,
          familyId: 'family-1',
          createdAt: new Date(),
        };
        jest.mocked(db.RememberToken.create).mockResolvedValueOnce(createdInstance as any);

        const predecessor = new RememberToken(1, 'old-hash', 7, expiry, null, 'family-1');
        const successorSeed = new RememberToken(0, 'new-hash', predecessor.idUser, predecessor.expiryDate, undefined, predecessor.familyId);

        const successor = await repository.insertSuccessor(successorSeed, fakeTx);

        expect(successor.idRememberToken).toBe(42);
        expect(successor.familyId).toBe('family-1');
        expect(db.RememberToken.create).toHaveBeenCalledWith(
          expect.objectContaining({ idUser: 7, tokenHash: 'new-hash', expiryDate: expiry, familyId: 'family-1' }),
          expect.objectContaining({ transaction: fakeTx })
        );
      });
    });

    describe('revokeFamily', () => {
      it('revokes every non-revoked row in the family and returns the affected count', async () => {
        jest.mocked(db.RememberToken.update).mockResolvedValueOnce([2] as any);

        const revoked = await repository.revokeFamily('family-1');

        expect(revoked).toBe(2);
        expect(db.RememberToken.update).toHaveBeenCalledWith(
          expect.objectContaining({ revokedAt: expect.any(Date) }),
          expect.objectContaining({ where: { familyId: 'family-1', revokedAt: null } })
        );
      });

      it('returns 0 when the family has no rows left to revoke', async () => {
        jest.mocked(db.RememberToken.update).mockResolvedValueOnce([0] as any);

        const revoked = await repository.revokeFamily('empty-family');

        expect(revoked).toBe(0);
      });
    });

    describe('reapFamily', () => {
      it('deletes only rows past the grace window for that family and returns the affected count', async () => {
        jest.mocked(db.RememberToken.destroy).mockResolvedValueOnce(2);

        const reaped = await repository.reapFamily('family-1', 30, fakeTx);

        expect(reaped).toBe(2);
        expect(db.RememberToken.destroy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ familyId: 'family-1' }),
            transaction: fakeTx,
          })
        );
      });

      it('returns 0 when nothing in the family has passed its grace window', async () => {
        jest.mocked(db.RememberToken.destroy).mockResolvedValueOnce(0);

        const reaped = await repository.reapFamily('family-1', 30, fakeTx);

        expect(reaped).toBe(0);
      });
    });
  });
});
