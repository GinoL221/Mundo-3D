const ProductDefine = require('../Product');
const { DataTypes } = require('sequelize');

describe('Product Model Definition', () => {
  it('defines Product with camelCase attributes, snake_case fields, and legacy getters', () => {
    const defineMock = jest.fn((name, attributes, options) => {
      return { name, attributes, options };
    });
    const mockSequelize = {
      define: defineMock,
    };

    ProductDefine(mockSequelize);

    expect(defineMock).toHaveBeenCalledWith(
      'Product',
      expect.objectContaining({
        idProduct: expect.objectContaining({
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_product',
        }),
        idCategory: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'id_category',
        }),
        idFranchise: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'id_franchise',
        }),
        nameProduct: expect.objectContaining({
          type: DataTypes.STRING,
          allowNull: false,
          field: 'name_product',
        }),
        price: expect.objectContaining({
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          field: 'price',
        }),
        descriptionProduct: expect.objectContaining({
          type: DataTypes.TEXT,
          field: 'description_product',
        }),
        image: expect.objectContaining({
          type: DataTypes.STRING,
          field: 'image',
        }),
        material: expect.objectContaining({
          type: DataTypes.STRING,
          allowNull: true,
          field: 'material',
        }),
        height: expect.objectContaining({
          type: DataTypes.DECIMAL(6, 2),
          allowNull: true,
          field: 'height',
        }),
        width: expect.objectContaining({
          type: DataTypes.DECIMAL(6, 2),
          allowNull: true,
          field: 'width',
        }),
        depth: expect.objectContaining({
          type: DataTypes.DECIMAL(6, 2),
          allowNull: true,
          field: 'depth',
        }),
        finish: expect.objectContaining({
          type: DataTypes.STRING,
          allowNull: true,
          field: 'finish',
        }),
        productionTime: expect.objectContaining({
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'production_time',
        }),
      }),
      expect.objectContaining({
        tableName: 'Product',
        timestamps: false,
        getterMethods: expect.objectContaining({
          IDProduct: expect.any(Function),
          NameProduct: expect.any(Function),
          Price: expect.any(Function),
          DescriptionProduct: expect.any(Function),
          Image: expect.any(Function),
          IDCategory: expect.any(Function),
          IDFranchise: expect.any(Function),
          Material: expect.any(Function),
          Height: expect.any(Function),
          Width: expect.any(Function),
          Depth: expect.any(Function),
          Finish: expect.any(Function),
          ProductionTime: expect.any(Function),
        }),
      })
    );
  });
});
