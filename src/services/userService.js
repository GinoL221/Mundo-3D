const bcryptjs = require('bcryptjs');
const { User } = require('../database/models/db');

const UserService = {
  async findAll() {
    return User.findAll({
      attributes: { exclude: ['PasswordUser'] },
    });
  },

  async findByEmail(email, opts = {}) {
    const includePassword = opts.includePassword === true;

    const query = {
      where: { Email: email },
    };

    if (!includePassword) {
      query.attributes = { exclude: ['PasswordUser'] };
    }

    return User.findOne(query);
  },

  async findById(id) {
    return User.findByPk(id, {
      attributes: { exclude: ['PasswordUser'] },
    });
  },

  async create(data) {
    const hashedPassword = bcryptjs.hashSync(data.PasswordUser, 10);

    return User.create({
      FirstName: data.FirstName,
      LastName: data.LastName,
      Email: data.Email,
      PasswordUser: hashedPassword,
      Image: data.Image,
    });
  },

  async remove(id) {
    const user = await User.findByPk(id);
    if (!user) return false;

    await user.destroy();
    return true;
  },
};

module.exports = UserService;
