const path = require('path');
const { UserService } = require('../../services');

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await UserService.remove(id);

    if (!deleted) {
      return res.status(404).send('Usuario no encontrado');
    }

    res.redirect('/users');
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
};

module.exports = deleteUser;
