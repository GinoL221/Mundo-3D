const Sequelize = require('sequelize');
const config = require('../config/config.js')[process.env.NODE_ENV || 'development'];

function initializeModels() {
  const db = {};
  let sequelize;
  if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
  } else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
  }

  const UserModel = require('./User')(sequelize, Sequelize.DataTypes);
  const ProductModel = require('./Product')(sequelize, Sequelize.DataTypes);
  const ShoppingCartModel = require('./ShoppingCart')(sequelize, Sequelize.DataTypes);
  const CategoryModel = require('./Category')(sequelize, Sequelize.DataTypes);
  const FranchiseModel = require('./Franchise')(sequelize, Sequelize.DataTypes);
  const RememberTokenModel = require('./RememberToken')(sequelize, Sequelize.DataTypes);

  db['User'] = UserModel;
  db['Product'] = ProductModel;
  db['ShoppingCart'] = ShoppingCartModel;
  db['Category'] = CategoryModel;
  db['Franchise'] = FranchiseModel;
  db['RememberToken'] = RememberTokenModel;

  UserModel.hasMany(ShoppingCartModel, { foreignKey: 'idUser' });
  ShoppingCartModel.belongsTo(UserModel, { foreignKey: 'idUser' });
  UserModel.hasMany(RememberTokenModel, { foreignKey: 'idUser' });
  RememberTokenModel.belongsTo(UserModel, { foreignKey: 'idUser' });
  ProductModel.hasMany(ShoppingCartModel, {
    foreignKey: 'idProduct',
    as: 'ShoppingCarts',
  });
  ShoppingCartModel.belongsTo(ProductModel, {
    foreignKey: 'idProduct',
    as: 'product',
  });

  // Asociación Product -> Category
  ProductModel.belongsTo(CategoryModel, {
    foreignKey: 'idCategory',
    as: 'Category',
  });
  CategoryModel.hasMany(ProductModel, {
    foreignKey: 'idCategory',
    as: 'Products',
  });

  // Asociación Product -> Franchise
  ProductModel.belongsTo(FranchiseModel, {
    foreignKey: 'idFranchise',
    as: 'Franchise',
  });
  FranchiseModel.hasMany(ProductModel, {
    foreignKey: 'idFranchise',
    as: 'Products',
  });

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;
  return db;
}

module.exports = { initializeModels };
