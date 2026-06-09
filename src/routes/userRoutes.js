const express = require('express');
const multer = require('multer');
const path = require('path');
const { isUser, guestMiddleware, authMiddleware } = require('../middlewares/auth');
const loginLimiter = require('../middlewares/loginLimiter');

const { body } = require('express-validator');

const router = express.Router();

const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, path.join(__dirname, '../../public/img/users'));
  },
  filename: (req, file, callback) => {
    callback(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const uploadImgUser = multer({ storage: storage });

const validationsUsers = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar un nombre')
    .bail()
    .isLength({ min: 2, max: 10 })
    .withMessage('Tiene que tener entre 2 y 10 caracteres'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar un apellido')
    .bail()
    .isLength({ min: 2, max: 10 })
    .withMessage('Tiene que tener entre 2 y 10 caracteres'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar un mail')
    .bail()
    .isEmail()
    .withMessage('Tienes que ingresar un mail valido'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar una contraseña')
    .bail()
    .isLength({ min: 6, max: 16 })
    .withMessage('Tiene que tener entre 6 y 16 caracteres'),
  body('image').custom((value, { req }) => {
    let file = req.file;
    let acceptedExtensions = ['.jpg', '.png'];
    if (!file) {
      throw new Error('Tienes que subir una imagen');
    } else {
      let fileExtension = path.extname(file.originalname);
      if (!acceptedExtensions.includes(fileExtension)) {
        throw new Error(
          `Las extensiones de archivos permitidas son ${acceptedExtensions.join(', ')}`,
        );
      }
    }
    return true;
  }),
];

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

const loginValidation = [
  body('email').trim().isEmail().withMessage('Tienes que ingresar un mail válido'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar una contraseña')
    .bail()
    .isLength({ min: 6 })
    .withMessage('Tiene que tener al menos 6 caracteres'),
];

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
