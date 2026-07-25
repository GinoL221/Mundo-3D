const { Umzug, SequelizeStorage } = require('umzug');
const db = require('./models/db');

function buildMigrator() {
  return new Umzug({
    migrations: {
      glob: 'src/database/migrations/*.js',
    },
    context: db.sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize: db.sequelize }),
  });
}

module.exports = { buildMigrator };
