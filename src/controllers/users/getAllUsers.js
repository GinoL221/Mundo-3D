const path = require('path');
const { UserService } = require('../../services');

const getAllUsers = async (req, res, next) => {
  try {
    const allUsers = await UserService.findAll();

    const ruta = path.join(__dirname, '../../views/users/users.ejs');

    res.render(ruta, { allUsers });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    next(error);
  }
};

module.exports = getAllUsers;
