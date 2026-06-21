const { Product, Category, Franchise } = require('../database/models/db');

const ProductService = {
  async findAll() {
    return Product.findAll({
      include: [
        {
          model: Category,
          as: 'Category',
          attributes: ['idCategory', 'nameCategory'],
        },
        {
          model: Franchise,
          as: 'Franchise',
          attributes: ['idFranchise', 'nameFranchise'],
        },
      ],
    });
  },

  async findById(id) {
    return Product.findByPk(id);
  },

  async create(data) {
    return Product.create({
      nameProduct: data.nameProduct,
      price: data.price,
      descriptionProduct: data.descriptionProduct,
      image: data.image,
      idCategory: data.idCategory,
      idFranchise: data.idFranchise,
    });
  },

  async update(id, data) {
    const product = await Product.findByPk(id);
    if (!product) return null;

    product.nameProduct = data.nameProduct ?? product.nameProduct;
    product.price = data.price ?? product.price;
    product.descriptionProduct = data.descriptionProduct ?? product.descriptionProduct;
    product.image = data.image ?? product.image;
    product.idCategory = data.idCategory ?? product.idCategory;
    product.idFranchise = data.idFranchise ?? product.idFranchise;

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
          attributes: ['idCategory', 'nameCategory'],
        },
      ],
      order: [['idProduct', 'DESC']],
    });
  },

  transformWithCategoryCount(products) {
    const countByCategory = {};

    const mappedProducts = products.map((product) => {
      const categoryName = product.Category ? product.Category.nameCategory : 'Sin categoría';

      const categoryInfo = product.Category
        ? {
            idCategory: product.Category.idCategory,
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
        idProduct: product.idProduct,
        nameProduct: product.nameProduct,
        price: product.price,
        descriptionProduct: product.descriptionProduct,
        image: product.image,
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
