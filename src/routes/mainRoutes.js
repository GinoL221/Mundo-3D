const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

//Ruta del index(home)
router.get("/", (req, res) => {
  const ruta = path.join(__dirname, "../views/index");
  res.render(ruta);
});

// Ruta para la página "About Us"
router.get("/aboutUs", (req, res) => {
  const ruta = path.join(__dirname, "../views/aboutUs.ejs");
  res.render(ruta);
});

module.exports = router;
