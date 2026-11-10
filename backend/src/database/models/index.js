const Sequelize = require('sequelize');
const { initializeModelsForConnection } = require('./registerModels');
const { readE2EDatabaseContext, protectE2EConnections } = require('../e2e/context');
const configs = require('../config/config.js');

function initializeModels() {
  const e2eContext = readE2EDatabaseContext(process.env);
  const config = configs[process.env.NODE_ENV || 'development'];
  let sequelize;
  if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
  } else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
  }
  protectE2EConnections(sequelize, e2eContext);
  return initializeModelsForConnection(sequelize);
}

module.exports = { initializeModels };
