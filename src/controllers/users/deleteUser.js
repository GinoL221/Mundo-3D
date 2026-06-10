const path = require('path');
const { UserService } = require('../../services');

const deleteUser = async (req, res, next) => {
  const { id } = req.params;

  try {
    const deleted = await UserService.remove(id);

    if (!deleted) {
      return res.status(404).send('Usuario no encontrado');
    }

    res.redirect('/users');
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    next(error);
  }
};

module.exports = deleteUser;
