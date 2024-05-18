const { User } = require("../../database/models"); // Asegúrate de importar el modelo User desde el archivo correcto
const path = require("path");

const getUserById = async (req, res) => {
  const ruta = path.join(__dirname, "../../views/users/user.ejs");
  const { id } = req.params;

  try {
    // Realiza una consulta a la base de datos para obtener el usuario por ID
    const user = await User.findByPk(id);

    if (!user) {
      // Si el usuario no existe, renderiza una vista de error 404
      return res.render(path.join(__dirname, "../../views/404NotFound"), {
        message: "User not found",
      });
    }

    // Renderiza la vista con los datos del usuario
    res.render(ruta, { user });
  } catch (error) {
    console.error("Error al obtener usuario por ID:", error);
    res.status(500).send("Error interno del servidor");
  }
};

module.exports = getUserById;
