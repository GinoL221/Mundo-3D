const { Category } = require('../database/models/db');

const CategoryService = {
  async findAll() {
    return Category.findAll();
  },

  async findById(id) {
    return Category.findByPk(id);
  },
};

module.exports = CategoryService;
