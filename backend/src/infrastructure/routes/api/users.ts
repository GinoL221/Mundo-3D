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

/**
 * @openapi
 * /users/login:
 *   post:
 *     summary: Authenticate and receive session cookies
 *     description: Sets m3d_auth (JWT, httpOnly), m3d_csrf and a display-data cookie. Also accepts `Email`/`Password` (normalized to lowercase before validation).
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               remember: { type: boolean }
 *             required: [email, password]
 *     responses:
 *       '200':
 *         description: Authenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       '400': { description: Validation error. }
 *       '401': { description: Email or password do not match. }
 *       '429': { description: Rate-limited (loginLimiter). }
 * /users/register:
 *   post:
 *     summary: Register a new user and receive session cookies
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string, minLength: 2, maxLength: 10 }
 *               lastName: { type: string, minLength: 2, maxLength: 10 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8, maxLength: 32, description: 'Needs an uppercase, a digit and a special char.' }
 *               confirmPassword: { type: string }
 *               image: { type: string, format: binary, description: 'Required; .jpg/.png only.' }
 *             required: [firstName, lastName, email, password, confirmPassword, image]
 *     responses:
 *       '201':
 *         description: Registered.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       '400': { description: Validation error, or user already exists. }
 *       '429': { description: Rate-limited (registerLimiter). }
 * /users/logout:
 *   post:
 *     summary: Clear session cookies
 *     description: No apiAuthMiddleware — logout only ever removes authority, so it must succeed even with no/expired auth cookie (api-jwt-auth spec, "Logout without an active session").
 *     tags: [Users]
 *     responses:
 *       '204': { description: Logged out (always, regardless of prior session state). }
 * /users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       '200':
 *         description: All users.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UsersIndexResponse' }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN. }
 * /users/{id}:
 *   get:
 *     summary: Get one user by id (admin only)
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The user.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN. }
 *       '404': { description: User not found. }
 */
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
