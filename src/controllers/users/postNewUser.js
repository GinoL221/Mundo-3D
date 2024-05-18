const path = require("path");
const bcryptjs = require("bcryptjs");
const { validationResult } = require("express-validator");
const { User } = require("../../database/models");

const postNewUser = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render(
        path.join(__dirname, "../../views/users/register.ejs"),
        {
          errors: errors.mapped(),
          oldData: req.body,
        }
      );
    }

    if (!req.file) {
      throw new Error("Tienes que subir una imagen");
    }

    const { firstName, lastName, email, password } = req.body;
    const image = req.file.filename;

    const userInDB = await User.findOne({ where: { email } });
    if (userInDB) {
      return res.render(
        path.join(__dirname, "../../views/users/register.ejs"),
        {
          errors: {
            email: { msg: "Este email ya está registrado" },
          },
          oldData: req.body,
        }
      );
    }

    const newUser = await User.create({
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      PasswordUser: bcryptjs.hashSync(password, 10),
      Image: image,
    });

    console.log("Usuario creado:", newUser);
    res.redirect("/users");
  } catch (error) {
    console.error("Error en el controlador postNewUser:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = postNewUser;
