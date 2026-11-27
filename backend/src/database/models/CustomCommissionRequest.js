const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'CustomCommissionRequest',
    {
      idCustomCommissionRequest: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_custom_commission_request',
      },
      name: { type: DataTypes.STRING(255), allowNull: false, field: 'name' },
      email: { type: DataTypes.STRING(320), allowNull: false, field: 'email' },
      phone: { type: DataTypes.STRING(30), allowNull: true, field: 'phone' },
      idea: { type: DataTypes.TEXT, allowNull: false, field: 'idea' },
      idProduct: { type: DataTypes.INTEGER, allowNull: true, field: 'id_product' },
      idUser: { type: DataTypes.INTEGER, allowNull: true, field: 'id_user' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    },
    { tableName: 'CustomCommissionRequest', timestamps: false },
  );
