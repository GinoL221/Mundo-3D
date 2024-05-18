const path = require("path");

const loginUsers = (req, res) => {
  const ruta = path.join(__dirname, "../../views/users/login.ejs");
  return res.render(ruta);
};

module.exports = loginUsers;
