const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mainController = require('../controllers/mainController');

// Ruta del index(home) — dynamic product listing
router.get('/', mainController.index.bind(mainController));

// Ruta para la página "About Us"
router.get('/aboutUs', (req, res) => {
  const ruta = path.join(__dirname, '../views/aboutUs.ejs');
  res.render(ruta);
});

module.exports = router;
