const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const process = require("process");
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.js")[env];
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

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 &&
      file !== basename &&
      file.slice(-3) === ".js" &&
      file.indexOf(".test.js") === -1
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
