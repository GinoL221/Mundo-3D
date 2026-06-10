const express = require('express');
const router = express.Router();
const { home, aboutUs } = require('../controllers/main');

// Ruta del index(home) — dynamic product listing
router.get('/', home);

// Ruta para la página "About Us"
router.get('/aboutUs', aboutUs);

module.exports = router;
