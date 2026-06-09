const path = require('path');
const { UserService } = require('../../services');

const getAllUsers = async (req, res) => {
  try {
    const allUsers = await UserService.findAll();

    const ruta = path.join(__dirname, '../../views/users/users.ejs');

    res.render(ruta, { allUsers });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).send('Error interno del servidor');
  }
};

module.exports = getAllUsers;
