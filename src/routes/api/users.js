const express = require('express');
const jwt = require('jsonwebtoken');
const { UserService } = require('../../services');
const { apiAuthMiddleware } = require('../../middlewares/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
const JWT_EXPIRES_IN = '1h';

// POST /api/users/login — authenticates API clients and issues a JWT
router.post('/users/login', async (req, res) => {
  const { Email, Password } = req.body;

  try {
    const user = await UserService.findByEmail(Email, { includePassword: true });

    if (!user || !UserService.verifyPassword(Password, user.PasswordUser)) {
      return res.status(401).json({ error: 'El email o la contraseña no coinciden' });
    }

    const payload = {
      userID: user.IDUser,
      Email: user.Email,
      Category: user.Category,
      IDRole: user.IDRole,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({ token });
  } catch (error) {
    console.error('Error al procesar el login de API:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/users — all users (password excluded)
router.get('/users', apiAuthMiddleware, async (req, res) => {
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
router.get('/users/:id', apiAuthMiddleware, async (req, res) => {
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
