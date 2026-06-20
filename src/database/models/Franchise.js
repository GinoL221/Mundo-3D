const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Franchise = sequelize.define(
    'Franchise',
    {
      idFranchise: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        field: 'id_franchise',
      },
      nameFranchise: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'name_franchise',
      },
    },
    {
      tableName: 'Franchise',
      timestamps: false,
      getterMethods: {
        IDFranchise() {
          return this.idFranchise;
        },
        NameFranchise() {
          return this.nameFranchise;
        },
      },
    },
  );

  return Franchise;
};
