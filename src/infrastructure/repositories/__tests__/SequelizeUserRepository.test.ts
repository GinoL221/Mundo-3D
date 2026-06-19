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

        expect(created.idUser).toBeGreaterThan(0);
        expect(created.firstName).toBe('John');
        expect(created.lastName).toBe('Doe');
        expect(created.email).toBe('john.doe@example.com');
        expect(created.password).toBe('hashedpassword');
        expect(created.image).toBe('image.png');
      } else {
        const mockInstance = {
          idUser: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          passwordUser: 'hashedpassword',
          image: 'image.png',
        };
        jest.mocked(db.User.create).mockResolvedValue(mockInstance as any);

        const userData = new User(0, 'John', 'Doe', 'john.doe@example.com', 'hashedpassword', 'image.png');
        const created = await repository.create(userData);

        expect(created.idUser).toBe(1);
        expect(created.firstName).toBe('John');
        expect(db.User.create).toHaveBeenCalled();
      }
    });
  });

  describe('findById', () => {
    it('should find user by primary key', async () => {
      if (isSqliteAvailable) {
        const createdModel = await sqliteUserModel.create({
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          passwordUser: 'password123',
          image: 'alice.png',
        });

        const found = await repository.findById(createdModel.idUser);
        expect(found).not.toBeNull();
        expect(found?.firstName).toBe('Alice');
        expect(found?.lastName).toBe('Smith');
        expect(found?.email).toBe('alice@example.com');
        expect(found?.password).toBe('password123');
        expect(found?.image).toBe('alice.png');
      } else {
        const mockInstance = {
          idUser: 2,
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          passwordUser: 'password123',
          image: 'alice.png',
        };
        jest.mocked(db.User.findByPk).mockResolvedValue(mockInstance as any);

        const found = await repository.findById(2);
        expect(found).not.toBeNull();
        expect(found?.idUser).toBe(2);
        expect(found?.firstName).toBe('Alice');
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
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@example.com',
          passwordUser: 'securepwd',
          image: null,
        });

        const found = await repository.findByEmail('bob@example.com');
        expect(found).not.toBeNull();
        expect(found?.firstName).toBe('Bob');
        expect(found?.email).toBe('bob@example.com');
      } else {
        const mockInstance = {
          idUser: 3,
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@example.com',
          passwordUser: 'securepwd',
          image: null,
        };
        jest.mocked(db.User.findOne).mockResolvedValue(mockInstance as any);

        const found = await repository.findByEmail('bob@example.com');
        expect(found).not.toBeNull();
        expect(found?.email).toBe('bob@example.com');
        expect(db.User.findOne).toHaveBeenCalledWith({ where: { email: 'bob@example.com' } });
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

  describe('findAll', () => {
    it('should return all users mapped to domain entities', async () => {
      if (isSqliteAvailable) {
        await sqliteUserModel.destroy({ where: {} });
        await sqliteUserModel.create({
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          passwordUser: 'password123',
          image: 'alice.png',
        });
        await sqliteUserModel.create({
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@example.com',
          passwordUser: 'securepwd',
          image: null,
        });

        const users = await repository.findAll();
        expect(users).toHaveLength(2);
        expect(users[0].firstName).toBe('Alice');
        expect(users[1].firstName).toBe('Bob');
      } else {
        const mockInstances = [
          {
            idUser: 1,
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@example.com',
            passwordUser: 'password123',
            image: 'alice.png',
          },
          {
            idUser: 2,
            firstName: 'Bob',
            lastName: 'Jones',
            email: 'bob@example.com',
            passwordUser: 'securepwd',
            image: null,
          }
        ];
        (db.User as any).findAll = jest.fn().mockResolvedValue(mockInstances);

        const users = await repository.findAll();
        expect(users).toHaveLength(2);
        expect(users[0].idUser).toBe(1);
        expect(users[0].firstName).toBe('Alice');
        expect(users[1].idUser).toBe(2);
        expect(users[1].firstName).toBe('Bob');
        expect(db.User.findAll).toHaveBeenCalled();
      }
    });

    it('should return empty list when no users exist', async () => {
      if (isSqliteAvailable) {
        await sqliteUserModel.destroy({ where: {} });
        const users = await repository.findAll();
        expect(users).toEqual([]);
      } else {
        (db.User as any).findAll = jest.fn().mockResolvedValue([]);
        const users = await repository.findAll();
        expect(users).toEqual([]);
        expect(db.User.findAll).toHaveBeenCalled();
      }
    });
  });
});
