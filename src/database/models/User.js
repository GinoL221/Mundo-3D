const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      idUser: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_user',
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'first_name',
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'last_name',
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'email',
      },
      image: {
        type: DataTypes.STRING,
        field: 'image',
      },
      passwordUser: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'password_user',
      },
      idRole: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
        field: 'id_role',
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'User',
        field: 'category',
      },
    },
    {
      tableName: 'User',
      timestamps: false,
      getterMethods: {
        IDUser() {
          return this.idUser;
        },
        FirstName() {
          return this.firstName;
        },
        LastName() {
          return this.lastName;
        },
        Email() {
          return this.email;
        },
        Image() {
          return this.image;
        },
        IDRole() {
          return this.idRole;
        },
        Category() {
          return this.category;
        },
      },
    },
  );

  return User;
};
