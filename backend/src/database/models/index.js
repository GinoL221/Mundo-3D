const Sequelize = require('sequelize');
const { initializeModelsForConnection } = require('./registerModels');
const config = require('../config/config.js')[process.env.NODE_ENV || 'development'];

function initializeModels() {
  let sequelize;
  if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
  } else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
  }
  return initializeModelsForConnection(sequelize);
}

module.exports = { initializeModels };
