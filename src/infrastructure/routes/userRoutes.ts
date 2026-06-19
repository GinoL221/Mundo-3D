import { Router } from 'express';
import { isUser, guestMiddleware, adminGuard } from '../middlewares/auth';
import loginLimiter from '../middlewares/loginLimiter';
import createUpload from '../middlewares/upload';
import { validationsUsers, loginValidation } from '../middlewares/validators/userValidators';

// Legacy controllers for fallback routes
// @ts-ignore
import getAllUsers from '../../controllers/users/getAllUsers';
// @ts-ignore
import getUserById from '../../controllers/users/getUserById';
// @ts-ignore
import formNewUser from '../../controllers/users/formNewUser';
// @ts-ignore
import deleteUser from '../../controllers/users/deleteUser';
// @ts-ignore
import loginUsers from '../../controllers/users/loginUsers';
// @ts-ignore
import userProfile from '../../controllers/users/userProfile';

import { SequelizeUserRepository } from '../repositories/SequelizeUserRepository';
import { SequelizeRememberTokenRepository } from '../repositories/SequelizeRememberTokenRepository';
import { BcryptPasswordHasher } from '../security/BcryptPasswordHasher';
import { Sha256TokenHasher } from '../security/Sha256TokenHasher';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase';
import { CreateRememberTokenUseCase } from '../../application/use-cases/CreateRememberTokenUseCase';
import { DeleteRememberTokenUseCase } from '../../application/use-cases/DeleteRememberTokenUseCase';
import { UserController } from '../controllers/UserController';

const router = Router();
const uploadImgUser = createUpload('users');

// Dependency Injection
const userRepo = new SequelizeUserRepository();
const rememberTokenRepo = new SequelizeRememberTokenRepository();
const passwordHasher = new BcryptPasswordHasher();
const tokenHasher = new Sha256TokenHasher();

const authenticateUserUseCase = new AuthenticateUserUseCase(userRepo, passwordHasher);
const registerUserUseCase = new RegisterUserUseCase(userRepo, passwordHasher);
const createRememberTokenUseCase = new CreateRememberTokenUseCase(rememberTokenRepo, tokenHasher);
const deleteRememberTokenUseCase = new DeleteRememberTokenUseCase(rememberTokenRepo, tokenHasher);

const userController = new UserController(
  authenticateUserUseCase,
  registerUserUseCase,
  createRememberTokenUseCase,
  deleteRememberTokenUseCase
);

// Fallback legacy routes
router.get('/users', isUser, getAllUsers);
router.get('/register', guestMiddleware, formNewUser);
router.get('/login', guestMiddleware, loginUsers);
router.get('/profile/', isUser, userProfile);
router.get('/user/:id', isUser, getUserById);
router.delete('/users/delete/:id', adminGuard, deleteUser);

// Migrated routes using UserController
router.post('/users', uploadImgUser.single('image'), validationsUsers, userController.postNewUser);
router.post('/login', loginLimiter, loginValidation, userController.processLogin);
router.get('/logout', userController.logout);

export default router;
