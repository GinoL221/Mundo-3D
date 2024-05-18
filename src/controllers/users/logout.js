const logout = (req, res) => {
  res.clearCookie("userEmail");
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      } else {
        return res.redirect("/");
      }
    });
  } else {
    return res.redirect("/");
  }
};

module.exports = logout;
