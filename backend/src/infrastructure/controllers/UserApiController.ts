import { Request, Response, NextFunction } from 'express';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../application/use-cases/GetUserByIdUseCase';
import { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase';
import { CreateRememberTokenUseCase } from '../../application/use-cases/CreateRememberTokenUseCase';
import { RefreshSessionUseCase } from '../../application/use-cases/RefreshSessionUseCase';
import { RevokeRefreshTokenUseCase } from '../../application/use-cases/RevokeRefreshTokenUseCase';
import { InvalidCredentialsException } from '../../domain/exceptions/InvalidCredentialsException';
import { UserAlreadyExistsException } from '../../domain/exceptions/UserAlreadyExistsException';
import { cleanupUploadedFile } from '../utils/cleanupUploadedFile';
import { AUTH_COOKIE, REFRESH_COOKIE } from '../security/cookieOptions';
import {
  clearSessionCookies,
  issueAccessCookie,
  issueRefreshCookie,
  generateRefreshToken,
  readFamilyIdFromAccessToken,
  establishSession,
} from './sessionCookies';

export class UserApiController {
  constructor(
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly registerUserUseCase?: RegisterUserUseCase,
    private readonly createRememberTokenUseCase?: CreateRememberTokenUseCase,
    private readonly refreshSessionUseCase?: RefreshSessionUseCase,
    private readonly revokeRefreshTokenUseCase?: RevokeRefreshTokenUseCase
  ) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.body.Email || req.body.email;
      const password = req.body.Password || req.body.password;
      const remember = req.body.remember === true || req.body.remember === 'true';

      const userDto = await this.authenticateUserUseCase.execute({ email, password });
      await establishSession(res, this.createRememberTokenUseCase, userDto, remember);

      res.json({
        user: {
          idUser: userDto.idUser,
          firstName: userDto.firstName,
          lastName: userDto.lastName,
          email: userDto.email,
          image: userDto.image,
          idRole: userDto.idRole,
          category: userDto.category,
        }
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsException) {
        res.status(401).json({ error: 'El email o la contraseña no coinciden' });
        return;
      }
      next(error);
    }
  };

  // No apiAuthMiddleware ahead of this route (design.md D5) — logout must
  // succeed even with an absent/expired/invalid auth cookie. The familyId
  // claim is only trusted after jwt.verify succeeds, so it cannot be forged.
  // Only the jwt.verify step is allowed to fail silently (expired/invalid/
  // missing access token — api-jwt-auth: "Logout without an active
  // session"). A genuine revocation failure (e.g. a DB error) must NOT be
  // swallowed by that same tolerance, or logout would report success while
  // the family was never actually revoked (found during PR2 apply).
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.[AUTH_COOKIE];
      const familyId = token ? readFamilyIdFromAccessToken(token) : undefined;
      if (familyId && this.revokeRefreshTokenUseCase) {
        await this.revokeRefreshTokenUseCase.execute(familyId);
      }
      clearSessionCookies(res);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.refreshSessionUseCase) {
        throw new Error('RefreshSessionUseCase not injected');
      }

      const presentedPlainToken = req.cookies?.[REFRESH_COOKIE];
      if (!presentedPlainToken) {
        res.status(401).json({ error: 'Sesión expirada' });
        return;
      }

      const newPlainToken = generateRefreshToken();
      const result = await this.refreshSessionUseCase.execute({ presentedPlainToken, newPlainToken });

      // 'reuse-detected' MUST fold into the same 401 as an ordinary
      // rejection (design.md D2/D3) — the response must never reveal that
      // a family-wide revocation just fired.
      if (result.outcome === 'rejected' || result.outcome === 'reuse-detected') {
        res.status(401).json({ error: 'Sesión expirada' });
        return;
      }

      const { user, familyId, familyExpiresAt } = result;
      // The cookie tracks what remains of the FAMILY, not a fresh default.
      // Passing nothing here re-issued every remembered session at 2h.
      issueAccessCookie(
        res,
        { userId: user.idUser, email: user.email, category: user.category, idRole: user.idRole, familyId },
        Math.max(0, familyExpiresAt.getTime() - Date.now())
      );

      // Only the rotation winner ever writes the refresh cookie (design.md
      // D2) — a grace hit must not, or it would overwrite the winner's
      // Set-Cookie with the superseded value in the shared cookie jar.
      if (result.outcome === 'rotated') {
        const maxAge = result.refreshToken.expiryDate.getTime() - Date.now();
        issueRefreshCookie(res, newPlainToken, maxAge);
      }

      res.json({
        user: {
          idUser: user.idUser,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          image: user.image,
          idRole: user.idRole,
          category: user.category,
        }
      });
    } catch (error) {
      next(error);
    }
  };

  register = async (
    req: Request & { file?: { key: string; location: string } },
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.registerUserUseCase) {
        throw new Error('RegisterUserUseCase not injected');
      }

      if (!req.file) {
        res.status(400).json({ error: 'Tienes que subir una imagen' });
        return;
      }

      const { firstName, lastName, email, password } = req.body;
      const image = req.file.location;

      const userDto = await this.registerUserUseCase.execute({ firstName, lastName, email, password, image });
      await establishSession(res, this.createRememberTokenUseCase, userDto);

      res.status(201).json({
        user: {
          idUser: userDto.idUser,
          firstName: userDto.firstName,
          lastName: userDto.lastName,
          email: userDto.email,
          image: userDto.image,
          idRole: userDto.idRole,
          category: userDto.category,
        }
      });
    } catch (error) {
      if (error instanceof UserAlreadyExistsException) {
        if (req.file?.key) {
          cleanupUploadedFile(req.file.key);
        }
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.listUsersUseCase.execute();
      res.json({ count: users.length, users });
    } catch (error) {
      next(error);
    }
  };

  show = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const user = await this.getUserByIdUseCase.execute(id);
      res.json(user);
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }
      next(error);
    }
  };
}
