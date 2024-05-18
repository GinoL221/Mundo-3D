const path = require("path");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const { User } = require("../../database/models");

const processLogin = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      const { email, password, remember } = req.body;

      // Buscar el usuario por su email en la base de datos
      const userToLogin = await User.findOne({
        where: { email },
        attributes: [
          "IDUser",
          "FirstName",
          "LastName",
          "Email",
          "Image",
          "PasswordUser",
        ],
      });

      if (userToLogin) {
        // Verificar si la contraseña coincide utilizando bcrypt
        if (bcrypt.compareSync(password, userToLogin.PasswordUser)) {
          // Eliminar la contraseña antes de almacenar el usuario en la sesión
          const userWithoutPassword = {
            IDUser: userToLogin.IDUser,
            FirstName: userToLogin.FirstName,
            LastName: userToLogin.LastName,
            Email: userToLogin.Email,
            Image: userToLogin.Image,
          };

          req.session.userLogged = userWithoutPassword;

          if (remember) {
            res.cookie("userEmail", email, { maxAge: 1000 * 60 * 30 });
          }

          return res.redirect("profile");
        } else {
          // Contraseña incorrecta
          return res.render(
            path.join(__dirname, "../../views/users/login.ejs"),
            {
              errors: {
                email: {
                  msg: "El email o la contraseña no coinciden",
                },
                password: {
                  msg: "El email o la contraseña no coinciden",
                },
              },
              oldData: req.body.email,
            }
          );
        }
      } else {
        // Usuario no encontrado
        return res.render(path.join(__dirname, "../../views/users/login.ejs"), {
          errors: {
            email: {
              msg: "El email o la contraseña no coinciden",
            },
            password: {
              msg: "El email o la contraseña no coinciden",
            },
          },
          oldData: req.body.email,
        });
      }
    } else {
      return res.render(path.join(__dirname, "../../views/users/login.ejs"), {
        errors: errors.mapped(),
        oldData: req.body,
      });
    }
  } catch (error) {
    console.error("Error al procesar el login:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

module.exports = processLogin;
