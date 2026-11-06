const Sequelize = require('sequelize');

function initializeModelsForConnection(sequelize) {
  if (!sequelize || typeof sequelize.define !== 'function') {
    throw new Error('Explicit Sequelize connection is required');
  }
  const db = {};
  const UserModel = require('./User')(sequelize, Sequelize.DataTypes);
  const ProductModel = require('./Product')(sequelize, Sequelize.DataTypes);
  const ShoppingCartModel = require('./ShoppingCart')(sequelize, Sequelize.DataTypes);
  const CategoryModel = require('./Category')(sequelize, Sequelize.DataTypes);
  const FranchiseModel = require('./Franchise')(sequelize, Sequelize.DataTypes);
  const RememberTokenModel = require('./RememberToken')(sequelize, Sequelize.DataTypes);
  const EmailConfirmationTokenModel = require('./EmailConfirmationToken')(
    sequelize,
    Sequelize.DataTypes,
  );
  const OrderModel = require('./Order')(sequelize, Sequelize.DataTypes);
  const OrderItemModel = require('./OrderItem')(sequelize, Sequelize.DataTypes);
  const CustomCommissionRequestModel = require('./CustomCommissionRequest')(
    sequelize,
    Sequelize.DataTypes,
  );

  db['User'] = UserModel;
  db['Product'] = ProductModel;
  db['ShoppingCart'] = ShoppingCartModel;
  db['Category'] = CategoryModel;
  db['Franchise'] = FranchiseModel;
  db['RememberToken'] = RememberTokenModel;
  db['EmailConfirmationToken'] = EmailConfirmationTokenModel;
  db['Order'] = OrderModel;
  db['OrderItem'] = OrderItemModel;
  db['CustomCommissionRequest'] = CustomCommissionRequestModel;

  UserModel.hasMany(ShoppingCartModel, { foreignKey: 'idUser' });
  ShoppingCartModel.belongsTo(UserModel, { foreignKey: 'idUser' });
  UserModel.hasMany(RememberTokenModel, { foreignKey: 'idUser' });
  RememberTokenModel.belongsTo(UserModel, { foreignKey: 'idUser' });
  UserModel.hasMany(EmailConfirmationTokenModel, { foreignKey: 'idUser' });
  EmailConfirmationTokenModel.belongsTo(UserModel, { foreignKey: 'idUser' });
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

  // Asociación User -> Order -> OrderItem -> Product
  UserModel.hasMany(OrderModel, { foreignKey: 'idUser' });
  OrderModel.belongsTo(UserModel, { foreignKey: 'idUser' });
  OrderModel.hasMany(OrderItemModel, { foreignKey: 'idOrder', as: 'items' });
  OrderItemModel.belongsTo(OrderModel, { foreignKey: 'idOrder' });
  ProductModel.hasMany(OrderItemModel, { foreignKey: 'idProduct', as: 'OrderItems' });
  OrderItemModel.belongsTo(ProductModel, { foreignKey: 'idProduct', as: 'product' });
  ProductModel.hasMany(CustomCommissionRequestModel, { foreignKey: 'idProduct' });
  CustomCommissionRequestModel.belongsTo(ProductModel, {
    foreignKey: 'idProduct',
    onDelete: 'SET NULL',
    as: 'Product',
  });

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;
  return db;
}

module.exports = { initializeModelsForConnection };
