const path = require("path");

const userProfile = (req, res) => {
  // console.log(req.cookies.userEmail);
  const ruta = path.join(__dirname, "../../views/users/userProfile.ejs");
  return res.render(ruta, {
    user: req.session.userLogged,
  });
};

module.exports = userProfile;
