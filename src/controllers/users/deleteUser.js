// controllers/deleteUser.js
const path = require("path");

const { User } = require("../../database/models"); // Asegúrate de importar el modelo User adecuadamente

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).send("Usuario no encontrado");
    }

    await user.destroy();

    res.redirect("/users");
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).send(`Error: ${error.message}`);
  }
};

module.exports = deleteUser;
