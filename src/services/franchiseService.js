const { Franchise } = require('../database/models/db');

const FranchiseService = {
  async findAll() {
    return Franchise.findAll();
  },

  async findById(id) {
    return Franchise.findByPk(id);
  },
};

module.exports = FranchiseService;
