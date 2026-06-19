import { Router, Request, Response, NextFunction } from 'express';
import { SequelizeUserRepository } from '../../repositories/SequelizeUserRepository';
import { BcryptPasswordHasher } from '../../security/BcryptPasswordHasher';
import { AuthenticateUserUseCase } from '../../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../../application/use-cases/GetUserByIdUseCase';
import { UserApiController } from '../../controllers/UserApiController';
import loginLimiter from '../../middlewares/loginLimiter';
import { apiAuthMiddleware, adminGuard } from '../../middlewares/auth';
import { loginValidation } from '../../middlewares/validators/userValidators';
import { validationResult } from 'express-validator';

const router = Router();

const userRepo = new SequelizeUserRepository();
const passwordHasher = new BcryptPasswordHasher();

const authenticateUserUseCase = new AuthenticateUserUseCase(userRepo, passwordHasher);
const listUsersUseCase = new ListUsersUseCase(userRepo);
const getUserByIdUseCase = new GetUserByIdUseCase(userRepo);

const controller = new UserApiController(
  authenticateUserUseCase,
  listUsersUseCase,
  getUserByIdUseCase
);

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

const handleValidationErrors = (req: Request, res: Response, next: NextFunction): any => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
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

router.get('/users', apiAuthMiddleware, adminGuard, controller.index);
router.get('/users/:id', apiAuthMiddleware, adminGuard, controller.show);

export default router;
