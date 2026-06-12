const express = require('express');
const router = express.Router();
const { home, aboutUs, terms, privacy, faq, stepByStep, help } = require('../controllers/main');

// Ruta del index(home) — dynamic product listing
router.get('/', home);

// Ruta para la página "About Us"
router.get('/aboutUs', aboutUs);

// Rutas informativas del footer
router.get('/terms', terms);
router.get('/privacy', privacy);
router.get('/faq', faq);
router.get('/step-by-step', stepByStep);
router.get('/help', help);

module.exports = router;
