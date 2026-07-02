const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define(
    'Product',
    {
      idProduct: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_product',
      },
      idCategory: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_category',
      },
      idFranchise: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_franchise',
      },
      nameProduct: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'name_product',
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'price',
      },
      descriptionProduct: {
        type: DataTypes.TEXT,
        field: 'description_product',
      },
      image: {
        type: DataTypes.STRING,
        field: 'image',
      },
      material: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'material',
      },
      height: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        field: 'height',
      },
      width: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        field: 'width',
      },
      depth: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        field: 'depth',
      },
      finish: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'finish',
      },
      productionTime: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'production_time',
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'stock',
      },
    },
    {
      tableName: 'Product',
      timestamps: false,
      indexes: [{ unique: false, fields: ['id_category'] }],
      getterMethods: {
        IDProduct() {
          return this.idProduct;
        },
        IDCategory() {
          return this.idCategory;
        },
        IDFranchise() {
          return this.idFranchise;
        },
        NameProduct() {
          return this.nameProduct;
        },
        Price() {
          return this.price;
        },
        DescriptionProduct() {
          return this.descriptionProduct;
        },
        Image() {
          return this.image;
        },
        Material() {
          return this.material;
        },
        Height() {
          return this.height;
        },
        Width() {
          return this.width;
        },
        Depth() {
          return this.depth;
        },
        Finish() {
          return this.finish;
        },
        ProductionTime() {
          return this.productionTime;
        },
        Stock() {
          return this.stock;
        },
      },
    },
  );

  return Product;
};
