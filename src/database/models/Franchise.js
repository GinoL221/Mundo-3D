const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Franchise = sequelize.define(
    "Franchise",
    {
      IDFranchise: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      NameFranchise: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: "Franchise",
      timestamps: false,
    }
  );

  Franchise.sync({ force: false })
    .then(() => {
      console.log("Tabla de Franquicias sincronizada correctamente.");
    })
    .catch((error) => {
      console.error("Error al sincronizar la tabla de Franquicias:", error);
    });

  return Franchise;
};
