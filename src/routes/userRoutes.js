const express = require('express');
const { isUser, guestMiddleware } = require('../middlewares/auth');
const loginLimiter = require('../middlewares/loginLimiter');
const createUpload = require('../middlewares/upload');
const { validationsUsers, loginValidation } = require('../middlewares/validators/userValidators');

const router = express.Router();

const uploadImgUser = createUpload('users');

const {
  getAllUsers,
  getUserById,
  formNewUser,
  postNewUser,
  deleteUser,
  loginUsers,
  processLogin,
  userProfile,
  logout,
} = require('../controllers/users');

//Ruta para ver todos los usuarios
router.get('/users', isUser, getAllUsers);

//Ruta del register
router.get('/register', guestMiddleware, formNewUser);

//Proceso de registro
router.post('/users', uploadImgUser.single('image'), validationsUsers, postNewUser);

//Ruta de login
router.get('/login', guestMiddleware, loginUsers);
//Proceso de login
router.post('/login', loginLimiter, loginValidation, processLogin);

//Ruta del perfil del usuario
router.get('/profile/', isUser, userProfile);

//Ruta para buscar por ID
router.get('/user/:id', isUser, getUserById);

//Ruta para borrar un usuario
router.delete('/users/delete/:id', isUser, deleteUser);

//Cerrar sesion
router.get('/logout', logout);

module.exports = router;
