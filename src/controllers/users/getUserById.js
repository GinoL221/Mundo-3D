const { UserService } = require('../../services');
const path = require('path');

const getUserById = async (req, res) => {
  const ruta = path.join(__dirname, '../../views/users/user.ejs');
  const { id } = req.params;

  try {
    const user = await UserService.findById(id);

    if (!user) {
      return res.render(path.join(__dirname, '../../views/404NotFound'), {
        message: 'User not found',
      });
    }

    res.render(ruta, { user });
  } catch (error) {
    console.error('Error al obtener usuario por ID:', error);
    res.status(500).send('Error interno del servidor');
  }
};

module.exports = getUserById;
