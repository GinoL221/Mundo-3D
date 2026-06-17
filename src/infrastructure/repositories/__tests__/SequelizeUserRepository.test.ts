import { Sequelize } from 'sequelize';
import db from '../../../database/models/db';
import { SequelizeUserRepository } from '../SequelizeUserRepository';
import { User } from '../../../domain/entities/User';

let isSqliteAvailable = false;
let sequelize: Sequelize | null = null;
let sqliteUserModel: any = null;

try {
  require('sqlite3');
  sequelize = new Sequelize('sqlite::memory:', { logging: false });
  const UserDefine = require('../../../database/models/User');
  sqliteUserModel = UserDefine(sequelize);
  isSqliteAvailable = true;
} catch (e) {
  isSqliteAvailable = false;
}

describe('SequelizeUserRepository Integration Tests', () => {
  let repository: SequelizeUserRepository;
  const originalUser = db.User;

  beforeEach(async () => {
    repository = new SequelizeUserRepository();
    if (isSqliteAvailable && sequelize && sqliteUserModel) {
      (db as any).User = sqliteUserModel;
      await sequelize.sync({ force: true });
    } else {
      (db as any).User = {
        findByPk: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
      } as any;
    }
  });

  afterAll(() => {
    (db as any).User = originalUser;
  });

  describe('create', () => {
    it('should insert a new user and return user entity', async () => {
      if (isSqliteAvailable) {
        const userData = new User(0, 'John', 'Doe', 'john.doe@example.com', 'hashedpassword', 'image.png');
        const created = await repository.create(userData);

        expect(created.IDUser).toBeGreaterThan(0);
        expect(created.FirstName).toBe('John');
        expect(created.LastName).toBe('Doe');
        expect(created.Email).toBe('john.doe@example.com');
        expect(created.Password).toBe('hashedpassword');
        expect(created.Image).toBe('image.png');
      } else {
        const mockInstance = {
          IDUser: 1,
          FirstName: 'John',
          LastName: 'Doe',
          Email: 'john.doe@example.com',
          PasswordUser: 'hashedpassword',
          Image: 'image.png',
        };
        jest.mocked(db.User.create).mockResolvedValue(mockInstance as any);

        const userData = new User(0, 'John', 'Doe', 'john.doe@example.com', 'hashedpassword', 'image.png');
        const created = await repository.create(userData);

        expect(created.IDUser).toBe(1);
        expect(created.FirstName).toBe('John');
        expect(db.User.create).toHaveBeenCalled();
      }
    });
  });

  describe('findById', () => {
    it('should find user by primary key', async () => {
      if (isSqliteAvailable) {
        const createdModel = await sqliteUserModel.create({
          FirstName: 'Alice',
          LastName: 'Smith',
          Email: 'alice@example.com',
          PasswordUser: 'password123',
          Image: 'alice.png',
        });

        const found = await repository.findById(createdModel.IDUser);
        expect(found).not.toBeNull();
        expect(found?.FirstName).toBe('Alice');
        expect(found?.LastName).toBe('Smith');
        expect(found?.Email).toBe('alice@example.com');
        expect(found?.Password).toBe('password123');
        expect(found?.Image).toBe('alice.png');
      } else {
        const mockInstance = {
          IDUser: 2,
          FirstName: 'Alice',
          LastName: 'Smith',
          Email: 'alice@example.com',
          PasswordUser: 'password123',
          Image: 'alice.png',
        };
        jest.mocked(db.User.findByPk).mockResolvedValue(mockInstance as any);

        const found = await repository.findById(2);
        expect(found).not.toBeNull();
        expect(found?.IDUser).toBe(2);
        expect(found?.FirstName).toBe('Alice');
        expect(db.User.findByPk).toHaveBeenCalledWith(2);
      }
    });

    it('should return null if user not found', async () => {
      if (isSqliteAvailable) {
        const found = await repository.findById(9999);
        expect(found).toBeNull();
      } else {
        jest.mocked(db.User.findByPk).mockResolvedValue(null);
        const found = await repository.findById(9999);
        expect(found).toBeNull();
      }
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      if (isSqliteAvailable) {
        await sqliteUserModel.create({
          FirstName: 'Bob',
          LastName: 'Jones',
          Email: 'bob@example.com',
          PasswordUser: 'securepwd',
          Image: null,
        });

        const found = await repository.findByEmail('bob@example.com');
        expect(found).not.toBeNull();
        expect(found?.FirstName).toBe('Bob');
        expect(found?.Email).toBe('bob@example.com');
      } else {
        const mockInstance = {
          IDUser: 3,
          FirstName: 'Bob',
          LastName: 'Jones',
          Email: 'bob@example.com',
          PasswordUser: 'securepwd',
          Image: null,
        };
        jest.mocked(db.User.findOne).mockResolvedValue(mockInstance as any);

        const found = await repository.findByEmail('bob@example.com');
        expect(found).not.toBeNull();
        expect(found?.Email).toBe('bob@example.com');
        expect(db.User.findOne).toHaveBeenCalledWith({ where: { Email: 'bob@example.com' } });
      }
    });

    it('should return null if email does not exist', async () => {
      if (isSqliteAvailable) {
        const found = await repository.findByEmail('nonexistent@example.com');
        expect(found).toBeNull();
      } else {
        jest.mocked(db.User.findOne).mockResolvedValue(null);
        const found = await repository.findByEmail('nonexistent@example.com');
        expect(found).toBeNull();
      }
    });
  });
});
