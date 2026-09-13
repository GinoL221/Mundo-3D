import { Router, Request, Response, NextFunction } from 'express';
import { SequelizeUserRepository } from '../../repositories/SequelizeUserRepository';
import { SequelizeRememberTokenRepository } from '../../repositories/SequelizeRememberTokenRepository';
import { BcryptPasswordHasher } from '../../security/BcryptPasswordHasher';
import { Sha256TokenHasher } from '../../security/Sha256TokenHasher';
import { CryptoRandomIdGenerator } from '../../security/CryptoRandomIdGenerator';
import { SequelizeUnitOfWork } from '../../persistence/SequelizeUnitOfWork';
import { AuthenticateUserUseCase } from '../../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../../application/use-cases/GetUserByIdUseCase';
import { RegisterUserUseCase } from '../../../application/use-cases/RegisterUserUseCase';
import { ConfirmEmailUseCase } from '../../../application/use-cases/ConfirmEmailUseCase';
import { IssueEmailConfirmationUseCase } from '../../../application/use-cases/IssueEmailConfirmationUseCase';
import { ResendEmailConfirmationUseCase } from '../../../application/use-cases/ResendEmailConfirmationUseCase';
import { CreateRememberTokenUseCase } from '../../../application/use-cases/CreateRememberTokenUseCase';
import { RotateRefreshTokenUseCase } from '../../../application/use-cases/RotateRefreshTokenUseCase';
import { REFRESH_TOKEN_REAP_SECONDS } from '../../security/refreshTokenRetention';
import { RefreshSessionUseCase } from '../../../application/use-cases/RefreshSessionUseCase';
import { RevokeRefreshTokenUseCase } from '../../../application/use-cases/RevokeRefreshTokenUseCase';
import { PinoLogger } from '../../logging/PinoLogger';
import { UserApiController } from '../../controllers/UserApiController';
import { EmailConfirmationApiController } from '../../controllers/EmailConfirmationApiController';
import loginLimiter from '../../middlewares/loginLimiter';
import accountLoginLimiter from '../../middlewares/accountLoginLimiter';
import registerLimiter from '../../middlewares/registerLimiter';
import refreshLimiter from '../../middlewares/refreshLimiter';
import emailConfirmationAttemptLimiter from '../../middlewares/emailConfirmationAttemptLimiter';
import { apiAuthMiddleware, adminGuard } from '../../middlewares/auth';
import { loginValidation, validationsUsers } from '../../middlewares/validators/userValidators';
import createUpload from '../../middlewares/upload';
import handleValidationErrors from '../../middlewares/handleValidationErrors';
import { SequelizeEmailConfirmationTokenRepository } from '../../repositories/SequelizeEmailConfirmationTokenRepository';
import { CryptoConfirmationTokenGenerator } from '../../security/CryptoConfirmationTokenGenerator';
import { loadEmailConfirmationConfig } from '../../config/emailConfirmationConfig';
import { createNodemailerSmtpMailAdapter } from '../../mail/NodemailerSmtpMailAdapter';
import { EmailConfirmationAccountLimiter } from '../../rate-limit/emailConfirmationAccountLimiter';
import resendConfirmationIpLimiter from '../../middlewares/resendConfirmationIpLimiter';
import { resendEmailConfirmationValidation } from '../../middlewares/validators/emailConfirmationValidators';
const router = Router();

const userRepo = new SequelizeUserRepository();
const rememberTokenRepo = new SequelizeRememberTokenRepository();
const emailConfirmationTokenRepo = new SequelizeEmailConfirmationTokenRepository();
const passwordHasher = new BcryptPasswordHasher();
const tokenHasher = new Sha256TokenHasher();
const idGenerator = new CryptoRandomIdGenerator();
const uow = new SequelizeUnitOfWork();
const emailConfirmationEnvironmentKeys = [
  'PUBLIC_APP_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
] as const;
const hasEmailConfirmationConfiguration = emailConfirmationEnvironmentKeys.some(
  (key) => process.env[key] !== undefined,
);

// Non-production startup without any deployment email settings still composes
// the real adapter against safe local SMTP values. Any supplied email setting,
// and every production startup, remains subject to strict configuration validation.
const emailConfirmationEnvironment =
  process.env.NODE_ENV !== 'production' && !hasEmailConfirmationConfiguration
    ? {
        PUBLIC_APP_URL: 'http://localhost:4321',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_SECURE: 'false',
        SMTP_FROM: 'noreply@example.test',
        ...process.env,
      }
    : process.env;
const emailConfirmationConfig = loadEmailConfirmationConfig(emailConfirmationEnvironment);

if (!emailConfirmationConfig.smtp) {
  throw new Error('Email confirmation SMTP configuration is required');
}

const emailConfirmationClock = { now: () => new Date() };
const emailConfirmationIssuer = new IssueEmailConfirmationUseCase(
  emailConfirmationTokenRepo,
  uow,
  new CryptoConfirmationTokenGenerator(),
  tokenHasher,
  emailConfirmationConfig.publicOrigin,
  createNodemailerSmtpMailAdapter(emailConfirmationConfig.smtp),
  emailConfirmationClock,
  new PinoLogger(),
);
const resendEmailConfirmationUseCase = new ResendEmailConfirmationUseCase(
  userRepo,
  emailConfirmationIssuer,
  new EmailConfirmationAccountLimiter(emailConfirmationClock),
);

const authenticateUserUseCase = new AuthenticateUserUseCase(userRepo, passwordHasher);
const listUsersUseCase = new ListUsersUseCase(userRepo);
const getUserByIdUseCase = new GetUserByIdUseCase(userRepo);
const registerUserUseCase = new RegisterUserUseCase(
  userRepo,
  passwordHasher,
  emailConfirmationIssuer,
);
const createRememberTokenUseCase = new CreateRememberTokenUseCase(
  rememberTokenRepo,
  tokenHasher,
  idGenerator,
);
const rotateRefreshTokenUseCase = new RotateRefreshTokenUseCase(
  uow,
  rememberTokenRepo,
  tokenHasher,
  REFRESH_TOKEN_REAP_SECONDS,
);
const refreshSessionUseCase = new RefreshSessionUseCase(
  rememberTokenRepo,
  userRepo,
  tokenHasher,
  rotateRefreshTokenUseCase,
  new PinoLogger(),
);
const revokeRefreshTokenUseCase = new RevokeRefreshTokenUseCase(rememberTokenRepo);
const confirmEmailUseCase = new ConfirmEmailUseCase(
  emailConfirmationTokenRepo,
  uow,
  tokenHasher,
  emailConfirmationClock,
);
const emailConfirmationController = new EmailConfirmationApiController(
  confirmEmailUseCase,
  resendEmailConfirmationUseCase,
);

const controller = new UserApiController(
  authenticateUserUseCase,
  listUsersUseCase,
  getUserByIdUseCase,
  registerUserUseCase,
  createRememberTokenUseCase,
  refreshSessionUseCase,
  revokeRefreshTokenUseCase,
);

const uploadImgUser = createUpload('users');

const normalizeLoginBody = (req: Request, _res: Response, next: NextFunction) => {
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
 * /users/email-confirmation/confirm:
 *   post:
 *     summary: Confirm an email address with an opaque token
 *     description: Unauthenticated. The token is accepted only in the JSON request body.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string }
 *             required: [token]
 *     responses:
 *       '204': { description: Confirmation completed or was already completed. }
 *       '400': { description: Invalid or expired confirmation token. }
 * /users/email-confirmation/resend:
 *   post:
 *     summary: Request an email confirmation resend
 *     description: Unauthenticated. Syntactically valid requests receive the same acceptance response without disclosing account eligibility, send status, or rate-limit outcome. Local rate limiting is single-process only.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *             required: [email]
 *     responses:
 *       '202':
 *         description: Accepted without disclosing account eligibility, send status, or rate-limit outcome.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *               required: [message]
 * /users/logout:
 *   post:
 *     summary: Clear session cookies and revoke the refresh token family
 *     description: No apiAuthMiddleware — logout only ever removes authority, so it must succeed even with no/expired auth cookie (api-jwt-auth spec, "Logout without an active session"). Revokes the refresh family carried in the (verified) access JWT's familyId claim, when present.
 *     tags: [Users]
 *     responses:
 *       '204': { description: Logged out (always, regardless of prior session state). }
 * /users/refresh:
 *   post:
 *     summary: Exchange a valid refresh cookie for a fresh access token
 *     description: Authenticates solely via the httpOnly, path-scoped m3d_refresh cookie — does NOT require a valid/unexpired m3d_auth. Not behind apiAuthMiddleware, exempt from csrfGuard, rate-limited (refreshLimiter). Rotates the presented token on every current use; a token superseded less than 30s ago (grace window) returns a fresh access cookie only and sets no refresh cookie (refresh-token-rotation spec).
 *     tags: [Users]
 *     responses:
 *       '200':
 *         description: Refreshed. Sets a new m3d_auth cookie, and a new m3d_refresh cookie only on rotation (never on a grace hit).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       '401': { description: Refresh cookie absent, expired, revoked, or replayed past its grace window. }
 *       '429': { description: Rate-limited (refreshLimiter). }
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
// Both limiters run, and both run before validation so a malformed body
// still costs an attempt. loginLimiter caps password spraying per source
// address; accountLoginLimiter caps credential stuffing per account, which
// no per-IP counter can see once the attempts are spread across hosts.
// accountLoginLimiter must stay after normalizeLoginBody: that is what puts
// a client-sent `Email` where the limiter's key generator looks for it.
router.post(
  '/users/login',
  normalizeLoginBody,
  loginLimiter,
  accountLoginLimiter,
  loginValidation,
  handleValidationErrors,
  controller.login,
);

router.post(
  '/users/register',
  registerLimiter,
  uploadImgUser.single('image'),
  validationsUsers,
  handleValidationErrors,
  controller.register,
);

// No apiAuthMiddleware: logout only ever removes authority, so it must
// succeed (204) even with no/expired auth cookie — see specs/api-jwt-auth
// spec.md "Logout without an active session" (MUST NOT error).
router.post('/users/logout', controller.logout);

// No apiAuthMiddleware (the access token is expired by definition here) and
// no csrfGuard (never mounted globally — design.md D5's defenses are the
// httpOnly+sameSite=lax+path-scoped refresh cookie, rotation, and rate
// limiting instead). A refresh token replayed past its grace window revokes
// the whole family and is logged server-side, but the 401 response stays
// byte-identical to an ordinary rejection (refresh-token-reuse-detection
// design.md D2/D3).
router.post('/users/refresh', refreshLimiter, controller.refresh);

// Confirmation authority is the POST body token, never the caller session.
// The limiter deliberately precedes token validation so invalid attempts spend
// the same trusted-IP budget without evaluating account state.
router.post(
  '/users/email-confirmation/confirm',
  emailConfirmationAttemptLimiter,
  emailConfirmationController.confirm,
);

// Syntax validation deliberately precedes the trusted-IP limiter. Neither
// middleware queries account state; the use case owns normalized lookup and
// account-level reservation sequencing.
router.post(
  '/users/email-confirmation/resend',
  resendEmailConfirmationValidation,
  handleValidationErrors,
  resendConfirmationIpLimiter,
  emailConfirmationController.resend,
);

router.get('/users', apiAuthMiddleware, adminGuard, controller.index);
router.get('/users/:id', apiAuthMiddleware, adminGuard, controller.show);

export default router;
