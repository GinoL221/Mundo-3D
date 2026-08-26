import { Router, Request, Response, NextFunction } from 'express';
import { SequelizeUserRepository } from '../../repositories/SequelizeUserRepository';
import { BcryptPasswordHasher } from '../../security/BcryptPasswordHasher';
import { AuthenticateUserUseCase } from '../../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../../application/use-cases/GetUserByIdUseCase';
import { RegisterUserUseCase } from '../../../application/use-cases/RegisterUserUseCase';
import { UserApiController } from '../../controllers/UserApiController';
import loginLimiter from '../../middlewares/loginLimiter';
import registerLimiter from '../../middlewares/registerLimiter';
import { apiAuthMiddleware, adminGuard } from '../../middlewares/auth';
import { loginValidation, validationsUsers } from '../../middlewares/validators/userValidators';
import createUpload from '../../middlewares/upload';
import handleValidationErrors from '../../middlewares/handleValidationErrors';

const router = Router();

const userRepo = new SequelizeUserRepository();
const passwordHasher = new BcryptPasswordHasher();

const authenticateUserUseCase = new AuthenticateUserUseCase(userRepo, passwordHasher);
const listUsersUseCase = new ListUsersUseCase(userRepo);
const getUserByIdUseCase = new GetUserByIdUseCase(userRepo);
const registerUserUseCase = new RegisterUserUseCase(userRepo, passwordHasher);

const controller = new UserApiController(
  authenticateUserUseCase,
  listUsersUseCase,
  getUserByIdUseCase,
  registerUserUseCase
);

const uploadImgUser = createUpload('users');

const normalizeLoginBody = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    if (req.body.Email && !req.body.email) {
      req.body.email = req.body.Email;
    }
    if (req.body.Password && !req.body.password) {
      req.body.password = req.body.Password;
    }
  }
  next();
};

router.post(
  '/users/login',
  normalizeLoginBody,
  loginLimiter,
  loginValidation,
  handleValidationErrors,
  controller.login
);

router.post(
  '/users/register',
  registerLimiter,
  uploadImgUser.single('image'),
  validationsUsers,
  handleValidationErrors,
  controller.register
);

// No apiAuthMiddleware: logout only ever removes authority, so it must
// succeed (204) even with no/expired auth cookie — see specs/api-jwt-auth
// spec.md "Logout without an active session" (MUST NOT error).
router.post('/users/logout', controller.logout);

router.get('/users', apiAuthMiddleware, adminGuard, controller.index);
router.get('/users/:id', apiAuthMiddleware, adminGuard, controller.show);

export default router;
