const express = require('express');
const { UserService } = require('../../services');

const router = express.Router();

// GET /api/users — all users (password excluded)
router.get('/users', async (req, res) => {
  try {
    const allUsers = await UserService.findAll();

    const count = allUsers.length;
    res.json({ count, users: allUsers });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/users/:id — single user by ID (password excluded)
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserService.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error al obtener el usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
