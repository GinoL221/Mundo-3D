const bcryptjs = require('bcryptjs');
const { User, RememberToken } = require('../database/models/db');
const crypto = require('crypto');

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

  verifyPassword(plainPassword, hashedPassword) {
    return bcryptjs.compareSync(plainPassword, hashedPassword);
  },

  async createRememberToken(userId, plainToken, durationSeconds) {
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);

    return RememberToken.create({
      IDUser: userId,
      TokenHash: hashedToken,
      ExpiresAt: expiresAt,
    });
  },

  async verifyRememberToken(plainToken) {
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
    const tokenRecord = await RememberToken.findOne({
      where: { TokenHash: hashedToken },
    });

    if (!tokenRecord) {
      return null;
    }

    if (new Date() > new Date(tokenRecord.ExpiresAt)) {
      await tokenRecord.destroy();
      return null;
    }

    return this.findById(tokenRecord.IDUser);
  },

  async deleteRememberToken(plainToken) {
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
    return RememberToken.destroy({
      where: { TokenHash: hashedToken },
    });
  },
};

module.exports = UserService;
