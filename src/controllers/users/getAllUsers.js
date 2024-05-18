const path = require("path");

const { User } = require("../../database/models");

const getAllUsers = async (req, res) => {
  try {
    // Realiza una consulta a la base de datos para obtener todos los usuarios
    const allUsers = await User.findAll();

    // Mapea los usuarios para excluir la contraseña
    const usersWithoutPassword = allUsers.map((user) => {
      const { PasswordUser, ...userWithoutPassword } = user.toJSON();
      return userWithoutPassword;
    });
    console.log(usersWithoutPassword);
    // Renderiza la vista con la lista de usuarios obtenida de la base de datos
    const ruta = path.join(__dirname, "../../views/users/users.ejs");

    res.render(ruta, { allUsers: usersWithoutPassword });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).send("Error interno del servidor");
  }
};

module.exports = getAllUsers;
