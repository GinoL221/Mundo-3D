const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Franchise = sequelize.define(
    'Franchise',
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
        unique: true,
      },
    },
    {
      tableName: 'Franchise',
      timestamps: false,
    },
  );

  return Franchise;
};
