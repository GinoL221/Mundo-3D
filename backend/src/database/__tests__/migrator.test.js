jest.mock('../models/db', () => ({
  sequelize: {
    getQueryInterface: jest.fn(() => 'mockQueryInterface'),
  },
}));

jest.mock('umzug', () => {
  const UmzugMock = jest.fn(function UmzugMock(options) {
    this.options = options;
  });
  const SequelizeStorageMock = jest.fn((options) => ({
    __isSequelizeStorage: true,
    ...options,
  }));
  return { Umzug: UmzugMock, SequelizeStorage: SequelizeStorageMock };
});

const { Umzug, SequelizeStorage } = require('umzug');
const db = require('../models/db');
const { buildMigrator } = require('../migrator');

describe('buildMigrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wires the migrations glob to the migrations directory', () => {
    const migrator = buildMigrator();

    expect(migrator.options.migrations.glob).toBe('src/database/migrations/*.js');
  });

  it('wires the context to the sequelize query interface', () => {
    const migrator = buildMigrator();

    expect(db.sequelize.getQueryInterface).toHaveBeenCalled();
    expect(migrator.options.context).toBe('mockQueryInterface');
  });

  it('wires storage to a SequelizeStorage bound to db.sequelize', () => {
    const migrator = buildMigrator();

    expect(SequelizeStorage).toHaveBeenCalledWith(
      expect.objectContaining({ sequelize: db.sequelize })
    );
    expect(migrator.options.storage.__isSequelizeStorage).toBe(true);
  });

  it('constructs a real Umzug instance', () => {
    buildMigrator();

    expect(Umzug).toHaveBeenCalledTimes(1);
  });
});
