const Sequelize = require("sequelize");
const config = require("../config/config.js")[
  process.env.NODE_ENV || "development"
];

function initializeModels() {
  const db = {};
  let sequelize;
  if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
  } else {
    sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      config
    );
  }

  const UserModel = require("./User")(sequelize, Sequelize.DataTypes);
  const ProductModel = require("./Product")(sequelize, Sequelize.DataTypes);
  const ShoppingCartModel = require("./ShoppingCart")(
    sequelize,
    Sequelize.DataTypes
  );
  const CategoryModel = require("./Category")(sequelize, Sequelize.DataTypes);
  const FranchiseModel = require("./Franchise")(sequelize, Sequelize.DataTypes);

  db["User"] = UserModel;
  db["Product"] = ProductModel;
  db["ShoppingCart"] = ShoppingCartModel;
  db["Category"] = CategoryModel;
  db["Franchise"] = FranchiseModel;

  UserModel.hasMany(ShoppingCartModel, { foreignKey: "IDUser" });
  ShoppingCartModel.belongsTo(UserModel, { foreignKey: "IDUser" });
  ProductModel.hasMany(ShoppingCartModel, { foreignKey: "IDProduct" });
  ShoppingCartModel.belongsTo(ProductModel, { foreignKey: "IDProduct" });

  // Asociación Product -> Category
  ProductModel.belongsTo(CategoryModel, {
    foreignKey: "IDCategory",
    as: "Category",
  });
  CategoryModel.hasMany(ProductModel, {
    foreignKey: "IDCategory",
    as: "Products",
  });

  // Asociación Product -> Franchise
  ProductModel.belongsTo(FranchiseModel, {
    foreignKey: "IDFranchise",
    as: "Franchise",
  });
  FranchiseModel.hasMany(ProductModel, {
    foreignKey: "IDFranchise",
    as: "Products",
  });

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;
  return db;
}

module.exports = { initializeModels };
