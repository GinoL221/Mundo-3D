const { Product, Category, Franchise } = require('../database/models/db');

const ProductService = {
  async findAll() {
    return Product.findAll({
      include: [
        {
          model: Category,
          as: 'Category',
          attributes: ['IDCategory', 'NameCategory'],
        },
        {
          model: Franchise,
          as: 'Franchise',
          attributes: ['IDFranchise', 'NameFranchise'],
        },
      ],
    });
  },

  async findById(id) {
    return Product.findByPk(id);
  },

  async create(data) {
    return Product.create({
      NameProduct: data.NameProduct,
      Price: data.Price,
      DescriptionProduct: data.DescriptionProduct,
      Image: data.Image,
      IDCategory: data.IDCategory,
      IDFranchise: data.IDFranchise,
    });
  },

  async update(id, data) {
    const product = await Product.findByPk(id);
    if (!product) return null;

    product.NameProduct = data.NameProduct ?? product.NameProduct;
    product.Price = data.Price ?? product.Price;
    product.DescriptionProduct = data.DescriptionProduct ?? product.DescriptionProduct;
    product.Image = data.Image ?? product.Image;
    product.IDCategory = data.IDCategory ?? product.IDCategory;
    product.IDFranchise = data.IDFranchise ?? product.IDFranchise;

    await product.save();
    return product;
  },

  async remove(id) {
    const product = await Product.findByPk(id);
    if (!product) return false;

    await product.destroy();
    return true;
  },

  async findLatest() {
    return Product.findOne({
      include: [
        {
          model: Category,
          as: 'Category',
          attributes: ['IDCategory', 'NameCategory'],
        },
      ],
      order: [['IDProduct', 'DESC']],
    });
  },

  transformWithCategoryCount(products) {
    const countByCategory = {};

    const mappedProducts = products.map((product) => {
      const categoryName = product.Category ? product.Category.NameCategory : 'Sin categoría';

      const categoryInfo = product.Category
        ? {
            IDCategory: product.Category.IDCategory,
            IDType: product.Category.IDType,
          }
        : null;

      if (!countByCategory[categoryName]) {
        countByCategory[categoryName] = {
          count: 1,
          category: categoryInfo,
        };
      } else {
        countByCategory[categoryName].count++;
      }

      return {
        IDProduct: product.IDProduct,
        NameProduct: product.NameProduct,
        Price: product.Price,
        DescriptionProduct: product.DescriptionProduct,
        Image: product.Image,
        Category: categoryName,
      };
    });

    return {
      count: products.length,
      countByCategory,
      products: mappedProducts,
    };
  },
};

module.exports = ProductService;
